import { api } from './api'

// Per-company logo store. One logo per local issuer, keyed by the normalized
// issuer slug (see logoKey in catalog). Bytes live in Cloud Storage server-side;
// the report just points an <img> at logoImgUrl(key) and monograms on 404.

/** Keys (issuer slugs) that currently have an uploaded logo. */
export function listLogoKeys(): Promise<{ key: string }[]> {
  return api.get<{ key: string }[]>('/logos')
}

// Which company keys have an uploaded logo — fetched once and shared, so a logo
// widget knows to prefer the uploaded image over the ticker feed WITHOUT a
// per-logo probe (and its 404 flicker). Kept in sync as uploads/removals happen.
let uploadedKeys: Set<string> | null = null
let inflight: Promise<Set<string>> | null = null
export function uploadedLogoKeys(): Promise<Set<string>> {
  if (uploadedKeys) return Promise.resolve(uploadedKeys)
  if (!inflight) {
    inflight = listLogoKeys()
      .then((ks) => (uploadedKeys = new Set(ks.map((k) => k.key))))
      .catch(() => (uploadedKeys = new Set<string>()))
  }
  return inflight
}
const noteUploaded = (key: string) => uploadedKeys?.add(key)
const noteRemoved = (key: string) => uploadedKeys?.delete(key)

export async function uploadLogo(key: string, file: File): Promise<void> {
  const fd = new FormData()
  fd.append('file', file)
  // Raw fetch (not the JSON client) so the browser sets the multipart boundary.
  const res = await fetch(`/api/logos/${encodeURIComponent(key)}`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  noteUploaded(key)
}

export async function deleteLogo(key: string): Promise<unknown> {
  const r = await api.del(`/logos/${encodeURIComponent(key)}`)
  noteRemoved(key)
  return r
}

/** Image URL for a logo key. `bust` appends a cache-buster after a fresh upload. */
export function logoImgUrl(key: string, bust?: number): string {
  return `/api/logos/${encodeURIComponent(key)}${bust ? `?t=${bust}` : ''}`
}
