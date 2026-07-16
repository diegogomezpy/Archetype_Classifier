// ---------------------------------------------------------------------------
// PDF → text lines
// ---------------------------------------------------------------------------
// Extract a PDF's text as visual lines (left-to-right, top-to-bottom), the shape
// the bulletin parser expects. pdfjs is heavy, so it's imported dynamically —
// Vite emits it as a separate chunk fetched only when an admin uploads a PDF.

type TextItem = { str: string; transform: number[]; width: number }

// Group a page's text items into visual rows. pdfjs gives each glyph-run an
// (x, y) via transform[4]/[5]; items sharing a y (within tolerance) are one row.
function itemsToLines(items: TextItem[]): string[] {
  const rows: { y: number; items: TextItem[] }[] = []
  const TOL = 3 // points; same printed line
  for (const it of items) {
    if (!it.str) continue
    const y = it.transform[5]
    let row = rows.find((r) => Math.abs(r.y - y) <= TOL)
    if (!row) {
      row = { y, items: [] }
      rows.push(row)
    }
    row.items.push(it)
  }
  rows.sort((a, b) => b.y - a.y) // top of page first
  return rows.map((r) => {
    const sorted = r.items.slice().sort((a, b) => a.transform[4] - b.transform[4])
    // Join runs, inserting a gap marker when there's a wide horizontal jump so
    // the parser can tell adjacent table cells apart.
    let line = ''
    let prevRight: number | null = null
    for (const it of sorted) {
      const x = it.transform[4]
      if (prevRight != null) {
        const gap = x - prevRight
        line += gap > 8 ? '   ' : gap > 1.5 ? ' ' : ''
      }
      line += it.str
      prevRight = x + (it.width ?? 0)
    }
    return line.replace(/\s+/g, ' ').trim()
  })
}

export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist')
  // Worker URL resolved by Vite; kept inside the dynamic import so the whole
  // pdfjs graph stays in the lazy chunk.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    lines.push(...itemsToLines(content.items as TextItem[]))
  }
  await doc.destroy()
  return lines
}
