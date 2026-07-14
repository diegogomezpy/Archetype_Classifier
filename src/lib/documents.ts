import { api } from './api'

// Documents attached to an instrument (reports, term sheets, …). Bytes live in
// Cloud Storage; this is the metadata + upload/download helpers.

export type DocMeta = {
  id: string
  instrumentId: string
  name: string
  size: number
  contentType: string
  createdAt: string
}

export function listDocs(instrumentId: string): Promise<DocMeta[]> {
  return api.get<DocMeta[]>(`/instruments/${instrumentId}/docs`)
}

export async function uploadDoc(instrumentId: string, file: File): Promise<DocMeta> {
  const fd = new FormData()
  fd.append('file', file)
  // Raw fetch (not the JSON client) so the browser sets the multipart boundary.
  const res = await fetch(`/api/instruments/${instrumentId}/docs`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  return res.json() as Promise<DocMeta>
}

export function deleteDoc(id: string): Promise<unknown> {
  return api.del(`/docs/${id}`)
}

/** Direct URL to download a document (forces a download in the browser). */
export function docDownloadUrl(id: string): string {
  return `/api/docs/${id}?download`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
