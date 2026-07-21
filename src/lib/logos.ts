import { api } from './api'

// Per-company logo store. One logo per local issuer, keyed by the normalized
// issuer slug (see logoKey in catalog). Bytes live in Cloud Storage server-side;
// the report just points an <img> at logoImgUrl(key) and monograms on 404.

/** Keys (issuer slugs) that currently have an uploaded logo. */
export function listLogoKeys(): Promise<{ key: string }[]> {
  return api.get<{ key: string }[]>('/logos')
}

export async function uploadLogo(key: string, file: File): Promise<void> {
  const fd = new FormData()
  fd.append('file', file)
  // Raw fetch (not the JSON client) so the browser sets the multipart boundary.
  const res = await fetch(`/api/logos/${encodeURIComponent(key)}`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
}

export function deleteLogo(key: string): Promise<unknown> {
  return api.del(`/logos/${encodeURIComponent(key)}`)
}

/** Image URL for a logo key. `bust` appends a cache-buster after a fresh upload. */
export function logoImgUrl(key: string, bust?: number): string {
  return `/api/logos/${encodeURIComponent(key)}${bust ? `?t=${bust}` : ''}`
}
