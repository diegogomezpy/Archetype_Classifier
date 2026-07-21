// Best-effort English→Spanish translation for the free-text fields we pull from
// the market-data feed (company description, sector). It runs at fetch/refresh
// time and the result is CACHED alongside the English text (`<key>Es`), so the
// language toggle is instant and we translate a given blurb only once — company
// boilerplate almost never changes, so steady-state volume is ~zero.
//
// Engine: MyMemory (https://mymemory.translated.net) — a free public endpoint,
// no key and no billed cloud API to enable. Two constraints shape the code:
//   • 500-char cap per request → we chunk long text on sentence boundaries.
//   • a per-IP daily word limit (5k anonymous, 50k with a contact email) →
//     an optional TRANSLATE_CONTACT_EMAIL env var raises the ceiling.
// Everything here is best-effort: any failure returns '' and callers fall back
// to the English text, so a rate-limit or outage never breaks a fetch.

const ENDPOINT = 'https://api.mymemory.translated.net/get'
const MAX_CHUNK = 450 // under MyMemory's ~500-char hard cap, with headroom
const CHUNK_PAUSE_MS = 200 // gentle pacing so a burst doesn't trip the rate limit

const contactEmail = () => (process.env.TRANSLATE_CONTACT_EMAIL || '').trim()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Split text into <=MAX_CHUNK pieces, preferring sentence boundaries and falling
// back to word boundaries for a single over-long sentence.
function chunk(text: string): string[] {
  const out: string[] = []
  let buf = ''
  const flush = () => {
    if (buf) out.push(buf)
    buf = ''
  }
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (sentence.length > MAX_CHUNK) {
      flush()
      let rest = sentence
      while (rest.length > MAX_CHUNK) {
        let cut = rest.lastIndexOf(' ', MAX_CHUNK)
        if (cut <= 0) cut = MAX_CHUNK
        out.push(rest.slice(0, cut))
        rest = rest.slice(cut).trimStart()
      }
      buf = rest
    } else if ((buf ? buf.length + 1 : 0) + sentence.length > MAX_CHUNK) {
      flush()
      buf = sentence
    } else {
      buf = buf ? `${buf} ${sentence}` : sentence
    }
  }
  flush()
  return out
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

async function translateChunk(q: string): Promise<string> {
  const params = new URLSearchParams({ q, langpair: 'en|es' })
  const email = contactEmail()
  if (email) params.set('de', email)
  const res = await fetch(`${ENDPOINT}?${params.toString()}`)
  if (!res.ok) throw new Error(`mymemory http ${res.status}`)
  const body = (await res.json()) as {
    responseStatus?: number | string
    responseData?: { translatedText?: string }
  }
  const status = Number(body.responseStatus)
  if (status && status !== 200) throw new Error(`mymemory status ${status}`)
  const text = body.responseData?.translatedText ?? ''
  // On quota exhaustion MyMemory still 200s but returns an ALL-CAPS warning as
  // the "translation" — treat that as a failure rather than storing the warning.
  if (!text || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(text)) {
    throw new Error('mymemory unavailable')
  }
  return decodeEntities(text)
}

/** English→Spanish, best-effort. Returns '' on any failure (caller keeps EN). */
export async function translateToEs(text: string): Promise<string> {
  const src = (text || '').trim()
  if (!src) return ''
  try {
    const parts = chunk(src)
    const translated: string[] = []
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) await sleep(CHUNK_PAUSE_MS)
      translated.push(await translateChunk(parts[i]))
    }
    return translated.join(' ').trim()
  } catch (e) {
    console.error('translateToEs failed:', (e as Error)?.message ?? e)
    return ''
  }
}

// The pulled free-text fields we translate + cache as `<key>Es`. Numbers,
// tickers, exchange and the company name are language-neutral and left alone.
const TRANSLATABLE = ['description', 'sectorIndex'] as const

/**
 * Augment a fetched fields object with cached Spanish variants. When `prev`
 * (the instrument's currently-stored details) already holds a translation for
 * the SAME English text, reuse it instead of re-translating — so the daily
 * refresh only spends a translation call when the source text actually changed.
 */
export async function withEsFields(
  fields: Record<string, string>,
  prev?: Record<string, string>,
): Promise<Record<string, string>> {
  const out = { ...fields }
  for (const key of TRANSLATABLE) {
    const en = (fields[key] ?? '').trim()
    if (!en) continue
    const esKey = `${key}Es`
    const cached = (prev?.[esKey] ?? '').trim()
    if (prev && prev[key] === en && cached) {
      out[esKey] = cached
      continue
    }
    const es = await translateToEs(en)
    if (es) out[esKey] = es
  }
  return out
}
