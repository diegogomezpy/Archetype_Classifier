import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import {
  advisorsCol,
  catalogCol,
  clientsCol,
  configCol,
  newId,
  normalizeName,
  sessionsCol,
} from './db.js'
import { fetchInstrumentData } from './marketData.js'

const app = new Hono()

// Where the built frontend lives (populated by the Docker build).
const WEB_ROOT = process.env.WEB_ROOT || 'web'

const docData = <T>(d: FirebaseFirestore.QueryDocumentSnapshot): T => d.data() as T
const sortByCreatedDesc = <T extends { createdAt?: string }>(arr: T[]) =>
  arr.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

// ── health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ ok: true }))

// ── instrument catalog ───────────────────────────────────────────────────────
app.get('/api/catalog', async (c) => {
  const snap = await catalogCol.get()
  return c.json(snap.docs.map((d) => docData(d)))
})
// Seed only when empty (idempotent bootstrap from the client's bundled defaults).
app.post('/api/catalog/seed', async (c) => {
  const items = (await c.req.json()) as Array<{ id: string }>
  const existing = await catalogCol.limit(1).get()
  if (!existing.empty) {
    const snap = await catalogCol.get()
    return c.json({ seeded: false, items: snap.docs.map((d) => docData(d)) })
  }
  const batch = catalogCol.firestore.batch()
  for (const it of items) batch.set(catalogCol.doc(it.id), it)
  await batch.commit()
  return c.json({ seeded: true, items })
})
// Replace the whole catalog with the provided defaults (admin "reset").
app.post('/api/catalog/reset', async (c) => {
  const items = (await c.req.json()) as Array<{ id: string }>
  const existing = await catalogCol.get()
  const batch = catalogCol.firestore.batch()
  existing.docs.forEach((d) => batch.delete(d.ref))
  for (const it of items) batch.set(catalogCol.doc(it.id), it)
  await batch.commit()
  return c.json({ items })
})
app.put('/api/catalog/:id', async (c) => {
  const body = (await c.req.json()) as { id: string }
  await catalogCol.doc(c.req.param('id')).set(body)
  return c.json(body)
})
app.delete('/api/catalog/:id', async (c) => {
  await catalogCol.doc(c.req.param('id')).delete()
  return c.json({ ok: true })
})

// ── archetype config (single doc) ────────────────────────────────────────────
app.get('/api/config/archetypes', async (c) => {
  const doc = await configCol.doc('archetypes').get()
  return c.json(doc.exists ? doc.data() : null)
})
app.put('/api/config/archetypes', async (c) => {
  const body = await c.req.json()
  await configCol.doc('archetypes').set(body)
  return c.json(body)
})

// ── advisors ─────────────────────────────────────────────────────────────────
app.get('/api/advisors', async (c) => {
  const snap = await advisorsCol.get()
  return c.json(snap.docs.map((d) => docData(d)))
})
app.post('/api/advisors', async (c) => {
  const { name } = (await c.req.json()) as { name: string }
  const advisor = { id: newId(), name: String(name ?? '').trim(), createdAt: new Date().toISOString() }
  await advisorsCol.doc(advisor.id).set(advisor)
  return c.json(advisor)
})
app.put('/api/advisors/:id', async (c) => {
  const body = (await c.req.json()) as { id: string }
  await advisorsCol.doc(c.req.param('id')).set(body)
  return c.json(body)
})
app.delete('/api/advisors/:id', async (c) => {
  await advisorsCol.doc(c.req.param('id')).delete()
  return c.json({ ok: true })
})

// ── clients ──────────────────────────────────────────────────────────────────
app.get('/api/clients', async (c) => {
  const advisorId = c.req.query('advisorId')
  const q = advisorId ? clientsCol.where('advisorId', '==', advisorId) : clientsCol
  const snap = await q.get()
  return c.json(snap.docs.map((d) => docData(d)))
})

// ── sessions ─────────────────────────────────────────────────────────────────
app.get('/api/sessions', async (c) => {
  const advisorId = c.req.query('advisorId')
  const clientId = c.req.query('clientId')
  let q: FirebaseFirestore.Query = sessionsCol
  if (advisorId) q = q.where('advisorId', '==', advisorId)
  if (clientId) q = q.where('clientId', '==', clientId)
  const snap = await q.get()
  return c.json(sortByCreatedDesc(snap.docs.map((d) => docData<{ createdAt?: string }>(d))))
})
app.get('/api/sessions/:id', async (c) => {
  const doc = await sessionsCol.doc(c.req.param('id')).get()
  return doc.exists ? c.json(doc.data()) : c.json(null, 404)
})
// Submit a completed test: find-or-create the client (advisor + name), then
// write the session linked to both.
app.post('/api/sessions', async (c) => {
  const body = (await c.req.json()) as {
    advisorId?: string | null
    clientName?: string | null
    [k: string]: unknown
  }
  const advisorId = body.advisorId ?? null
  const name = (body.clientName ?? '').toString().trim()

  let clientId: string | null = null
  if (advisorId && name) {
    const key = normalizeName(name)
    const found = (await clientsCol.where('advisorId', '==', advisorId).get()).docs.find(
      (d) => normalizeName((d.data().name as string) ?? '') === key,
    )
    if (found) {
      clientId = found.id
    } else {
      clientId = newId()
      await clientsCol.doc(clientId).set({ id: clientId, advisorId, name, createdAt: new Date().toISOString() })
    }
  }

  const id = newId()
  const session = {
    ...body,
    id,
    advisorId,
    clientId,
    clientLabel: name || null,
    createdAt: new Date().toISOString(),
  }
  delete (session as Record<string, unknown>).clientName
  await sessionsCol.doc(id).set(session)
  return c.json(session)
})
app.delete('/api/sessions/:id', async (c) => {
  await sessionsCol.doc(c.req.param('id')).delete()
  return c.json({ ok: true })
})

// ── market data ──────────────────────────────────────────────────────────────
app.post('/api/market-data', async (c) => {
  const body = await c.req.json()
  return c.json(await fetchInstrumentData(body))
})

// ── static frontend + SPA fallback ───────────────────────────────────────────
let indexHtml = ''
try {
  indexHtml = readFileSync(join(WEB_ROOT, 'index.html'), 'utf8')
} catch {
  indexHtml = '<!doctype html><title>Investor Profile</title><div id="root"></div>'
}

// The HTML shell must NEVER be cached, so every load re-fetches the current
// index.html (which points at the latest content-hashed bundle) instead of a
// browser serving a stale cached app after a deploy.
const serveShell = (c: Context) => {
  c.header('Cache-Control', 'no-cache')
  return c.html(indexHtml)
}
app.get('/', serveShell)

// Content-hashed assets are immutable — cache them aggressively.
app.use('/assets/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'public, max-age=31536000, immutable')
})

app.use('/*', serveStatic({ root: WEB_ROOT }))
app.get('*', serveShell)

const port = Number(process.env.PORT) || 8080
serve({ fetch: app.fetch, port })
console.log(`server listening on :${port} (web root: ${WEB_ROOT})`)
