import { api } from './api'

// ---------------------------------------------------------------------------
// Bond issuer profiles
// ---------------------------------------------------------------------------
// An individual bond has no ticker, so the report can't look up a logo or a
// company blurb the way an equity does. The backend resolves the ISSUER's name
// to its listed equity (and caches the answer in Firestore); this module is the
// thin client for that, plus a per-session memo so re-opening the same bond —
// or several bonds from one issuer — costs a single request.

export type IssuerProfile = {
  ticker: string
  name: string
  description: string
  descriptionEs: string
}

const EMPTY: IssuerProfile = { ticker: '', name: '', description: '', descriptionEs: '' }

const memo = new Map<string, Promise<IssuerProfile>>()

/**
 * Resolve an issuer name to its listed equity + business summary. Sovereign and
 * private issuers resolve to an empty profile — callers fall back to a monogram.
 */
export function issuerProfile(name?: string): Promise<IssuerProfile> {
  const key = (name ?? '').trim()
  if (!key) return Promise.resolve(EMPTY)
  const hit = memo.get(key)
  if (hit) return hit
  const p = api
    .get<IssuerProfile>(`/issuer?name=${encodeURIComponent(key)}`)
    .then((r) => r ?? EMPTY)
    .catch(() => EMPTY)
  memo.set(key, p)
  return p
}
