import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLang } from '../i18n/i18n'
import { logoImgUrl, uploadLogo } from '../lib/logos'

// Company / asset logo, resolved through a fallback chain:
//   1. Parqet by ticker (US listings only — nothing for Paraguayan issuers)
//   2. the per-company upload store (/api/logos/:key)
//   3. a monogram of the name's initials on a paper chip
// When every source fails and `canUpload` is set the chip gains an upload
// control — the escape hatch for any company the feeds don't cover.
type Props = {
  ticker?: string
  name: string
  size?: number
  /** Canonical company key for the upload store (see companyKeyFor). */
  uploadKey?: string
  /** Offer an upload when no logo could be resolved. */
  canUpload?: boolean
}

const pick = (lang: 'en' | 'es', en: string, es: string) => (lang === 'es' ? es : en)

function monogram(name: string): string {
  const words = name
    .replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return '—'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function CompanyLogo({ ticker, name, size = 64, uploadKey, canUpload }: Props) {
  const { lang } = useLang()
  const sym = (ticker ?? '').trim().toUpperCase()
  const [bust, setBust] = useState(0)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Ordered candidates. A fresh upload jumps the store to the front so the new
  // image shows immediately instead of losing to a stale Parqet hit.
  const stored = uploadKey ? logoImgUrl(uploadKey, bust || undefined) : ''
  const parqet = sym
    ? `https://assets.parqet.com/logos/symbol/${encodeURIComponent(sym)}?size=128`
    : ''
  const sources = (bust ? [stored, parqet] : [parqet, stored]).filter(Boolean)

  // Reset to the top of the chain whenever the candidates change (the same
  // component instance renders different instruments as the advisor navigates).
  const chainKey = sources.join('|')
  const [idx, setIdx] = useState(0)
  useEffect(() => setIdx(0), [chainKey])

  const current = sources[idx] ?? ''

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !uploadKey) return
    setBusy(true)
    try {
      await uploadLogo(uploadKey, file)
      setBust(Date.now()) // re-point at the store and defeat the image cache
    } catch {
      /* leave the monogram in place */
    } finally {
      setBusy(false)
    }
  }

  if (!current) {
    const label = pick(lang, 'Upload a logo', 'Subir un logo')
    return (
      <div className="shrink-0" style={{ width: size }}>
        <div
          className="grid place-items-center rounded-2xl border border-border bg-surface2"
          style={{ width: size, height: size }}
          aria-hidden
        >
          <span className="font-serif font-semibold text-muted" style={{ fontSize: size * 0.34 }}>
            {monogram(name)}
          </span>
        </div>
        {canUpload && uploadKey && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title={label}
              className="no-print mt-1 w-full truncate text-center text-[10px] text-muted transition-colors hover:text-teal disabled:opacity-50"
            >
              {busy ? '…' : `+ ${pick(lang, 'logo', 'logo')}`}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFile}
              aria-label={label}
            />
          </>
        )}
      </div>
    )
  }

  // Real logos are drawn for light backgrounds, so give them a white chip that
  // reads correctly in either theme.
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-white shadow-soft"
      style={{ width: size, height: size }}
    >
      <img
        src={current}
        alt=""
        width={size}
        height={size}
        onError={() => setIdx((i) => i + 1)}
        className="h-full w-full object-contain p-2"
      />
    </div>
  )
}
