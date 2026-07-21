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
  docsBucket,
  documentsCol,
  logosCol,
  newId,
  normalizeName,
  sessionsCol,
} from './db.js'
import { fetchInstrumentData } from './marketData.js'
import { withEsFields } from './translate.js'

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

// ── risk-derivation params (single doc) ──────────────────────────────────────
app.get('/api/config/riskParams', async (c) => {
  const doc = await configCol.doc('riskParams').get()
  return c.json(doc.exists ? doc.data() : null)
})
app.put('/api/config/riskParams', async (c) => {
  const body = await c.req.json()
  await configCol.doc('riskParams').set(body)
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

// ── documents (instrument attachments) ────────────────────────────────────────
// File bytes live in Cloud Storage; metadata (name/size/type) lives in Firestore.
type DocMeta = {
  id: string
  instrumentId: string
  name: string
  size: number
  contentType: string
  gcsPath: string
  createdAt: string
}
const publicMeta = (m: DocMeta) => {
  const { gcsPath: _gcsPath, ...rest } = m
  return rest
}

app.get('/api/instruments/:id/docs', async (c) => {
  const snap = await documentsCol.where('instrumentId', '==', c.req.param('id')).get()
  const docs = snap.docs.map((d) => publicMeta(d.data() as DocMeta))
  docs.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  return c.json(docs)
})

app.post('/api/instruments/:id/docs', async (c) => {
  const instrumentId = c.req.param('id')
  const body = await c.req.parseBody()
  const file = body['file']
  if (!(file instanceof File)) return c.json({ error: 'no file' }, 400)
  const id = newId()
  const gcsPath = `instruments/${instrumentId}/${id}`
  const buf = Buffer.from(await file.arrayBuffer())
  await docsBucket.file(gcsPath).save(buf, {
    contentType: file.type || 'application/octet-stream',
    resumable: false,
  })
  const meta: DocMeta = {
    id,
    instrumentId,
    name: file.name || 'document',
    size: buf.length,
    contentType: file.type || 'application/octet-stream',
    gcsPath,
    createdAt: new Date().toISOString(),
  }
  await documentsCol.doc(id).set(meta)
  return c.json(publicMeta(meta))
})

app.get('/api/docs/:docId', async (c) => {
  const doc = await documentsCol.doc(c.req.param('docId')).get()
  if (!doc.exists) return c.json({ error: 'not found' }, 404)
  const meta = doc.data() as DocMeta
  const [buf] = await docsBucket.file(meta.gcsPath).download()
  const disp = c.req.query('download') != null ? 'attachment' : 'inline'
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': meta.contentType || 'application/octet-stream',
      'Content-Disposition': `${disp}; filename="${meta.name.replace(/["\r\n]/g, '')}"`,
    },
  })
})

app.delete('/api/docs/:docId', async (c) => {
  const ref = documentsCol.doc(c.req.param('docId'))
  const doc = await ref.get()
  if (doc.exists) {
    const meta = doc.data() as DocMeta
    await docsBucket.file(meta.gcsPath).delete().catch(() => {})
    await ref.delete()
  }
  return c.json({ ok: true })
})

// ── company logos ─────────────────────────────────────────────────────────────
// One logo per local company, keyed by a normalized issuer slug the client
// computes (logoKey). Bytes live in Cloud Storage; a tiny Firestore doc holds
// the content type. The report just points an <img> at /api/logos/:key and
// falls back to a monogram when it 404s, so no lookup table is needed.
type LogoMeta = { key: string; gcsPath: string; contentType: string; updatedAt: string }
const logoKeyOk = (k: string) => /^[a-z0-9]{1,64}$/.test(k)

app.get('/api/logos', async (c) => {
  const snap = await logosCol.get()
  return c.json(snap.docs.map((d) => ({ key: d.id })))
})

app.post('/api/logos/:key', async (c) => {
  const key = c.req.param('key')
  if (!logoKeyOk(key)) return c.json({ error: 'bad key' }, 400)
  const body = await c.req.parseBody()
  const file = body['file']
  if (!(file instanceof File)) return c.json({ error: 'no file' }, 400)
  const gcsPath = `logos/${key}`
  const buf = Buffer.from(await file.arrayBuffer())
  await docsBucket.file(gcsPath).save(buf, {
    contentType: file.type || 'image/png',
    resumable: false,
  })
  const meta: LogoMeta = {
    key,
    gcsPath,
    contentType: file.type || 'image/png',
    updatedAt: new Date().toISOString(),
  }
  await logosCol.doc(key).set(meta)
  return c.json({ key })
})

app.get('/api/logos/:key', async (c) => {
  const doc = await logosCol.doc(c.req.param('key')).get()
  if (!doc.exists) return c.json({ error: 'not found' }, 404)
  const meta = doc.data() as LogoMeta
  const [buf] = await docsBucket.file(meta.gcsPath).download()
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': meta.contentType || 'image/png',
      // Short cache; a re-upload should show up quickly (admin also cache-busts).
      'Cache-Control': 'public, max-age=60',
    },
  })
})

app.delete('/api/logos/:key', async (c) => {
  const ref = logosCol.doc(c.req.param('key'))
  const doc = await ref.get()
  if (doc.exists) {
    const meta = doc.data() as LogoMeta
    await docsBucket.file(meta.gcsPath).delete().catch(() => {})
    await ref.delete()
  }
  return c.json({ ok: true })
})

// ── market data ──────────────────────────────────────────────────────────────
app.post('/api/market-data', async (c) => {
  const body = await c.req.json()
  const res = await fetchInstrumentData(body)
  // Cache Spanish variants of the free-text fields (description, sector) so the
  // language toggle is instant. No `prev` here — a one-off fetch always translates.
  if (res.ok) res.fields = await withEsFields(res.fields)
  return c.json(res)
})

// Fields the market-data feed owns. Anything NOT in here is either the research
// firm's (priceTarget, recBuyPct, researchSource, their description) or the
// admin's, and a refresh must never overwrite it.
const MARKET_OWNED = [
  'description',
  'descriptionEs', // cached Spanish of `description` (see translate.ts)
  'kind',
  'sectorIndex',
  'sectorIndexEs', // cached Spanish of `sectorIndex`
  'exchange',
  'lastPrice',
  'change1Y',
  'range52w',
  'avgVolume',
  'marketCapAum',
  'dividendYield',
  'peRatio',
  'peForward',
  'expenseRatio',
  'beta',
  'impliedVol3m',
  'priceTarget',
  'recBuyPct',
  'recHoldPct',
  'recSellPct',
  'analystCount',
  'asOf',
] as const

const numOr = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Re-pull market data for every global instrument that has a ticker, refresh the
 * fields the feed owns, and recompute potentialReturn against the NEW price so
 * the research firm's target stays meaningful between their updates.
 * Driven by Cloud Scheduler once a day; safe to run by hand.
 */
app.post('/api/market-data/refresh', async (c) => {
  // Public service, but this endpoint fans out 50+ fetches and writes Firestore,
  // so gate it on a shared token when one is configured. No token set → open
  // (local + manual runs). Cloud Scheduler sends the header.
  const wanted = process.env.REFRESH_TOKEN
  if (wanted && c.req.header('x-refresh-token') !== wanted) {
    return c.json({ ok: false, error: 'unauthorized' }, 401)
  }
  const snap = await catalogCol.get()
  // Only the classes with a live market-data feed. A manually-filled bond or
  // structure might carry a ticker too, and we must never touch its details.
  const FETCHABLE = new Set(['Equities', 'Crypto'])
  const rows = snap.docs
    .map((d) => docData(d) as Record<string, unknown>)
    .filter(
      (i) =>
        i.region === 'global' &&
        FETCHABLE.has(String(i.assetClass ?? '')) &&
        String(i.ticker ?? '').trim(),
    )

  let updated = 0
  let failed = 0
  let skipped = 0

  for (const inst of rows) {
    const ticker = String(inst.ticker).trim()
    try {
      const res = await fetchInstrumentData({
        ticker,
        assetClass: String(inst.assetClass ?? ''),
      })
      if (!res.ok) {
        failed++
        continue
      }
      const details = { ...((inst.details as Record<string, string>) ?? {}) }
      // Add cached Spanish variants, reusing the stored translation when the
      // English text is unchanged so we don't re-translate the same blurb daily.
      const fields = await withEsFields(res.fields, details)
      // `description` is the fetched company summary and is market-owned; the
      // firm's `rationale` is NOT in MARKET_OWNED, so it's never touched here.
      for (const k of MARKET_OWNED) if (fields[k]) details[k] = fields[k]
      // The whole point of the daily run: keep upside honest against the tape.
      const target = numOr(details.priceTarget)
      const spot = numOr(details.lastPrice)
      if (target != null && spot != null && spot > 0) {
        const pct = (target / spot - 1) * 100
        details.potentialReturn = `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`
      }
      await catalogCol.doc(String(inst.id)).set({ ...inst, details }, { merge: true })
      updated++
    } catch {
      failed++
    }
    // Market data rate-limits; pace the loop rather than burst it.
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log(`market-data refresh: ${updated} updated, ${failed} failed, ${skipped} skipped`)
  return c.json({ ok: true, considered: rows.length, updated, failed })
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
