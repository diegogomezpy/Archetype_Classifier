import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLang } from '../i18n/i18n'
import { deleteLogo, logoImgUrl, uploadedLogoKeys, uploadLogo } from '../lib/logos'

// Company / asset logo, resolved through a fallback chain:
//   1. an uploaded logo in the per-company store (/api/logos/:key), if one exists
//   2. Parqet by ticker (US listings only — nothing for Paraguayan issuers)
//   3. a monogram of the name's initials on a paper chip
// A stored logo is preferred over the feed so a hand-picked replacement wins and
// survives reloads. When `canUpload` is set the chip carries its own upload /
// replace / remove controls — so any logo can be curated in place, from either
// the admin edit form or the advisor's report.
type Props = {
  ticker?: string
  name: string
  size?: number
  /** Canonical company key for the upload store (see companyKeyFor). */
  uploadKey?: string
  /** Show upload / replace / remove controls beneath the logo. */
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
  // Whether this company has an uploaded logo (null while the shared set loads).
  const [hasUpload, setHasUpload] = useState<boolean | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!uploadKey) {
      setHasUpload(false)
      return
    }
    let alive = true
    void uploadedLogoKeys().then((set) => alive && setHasUpload(set.has(uploadKey)))
    return () => {
      alive = false
    }
  }, [uploadKey])

  // A stored logo (known to exist, or just uploaded) leads the chain; otherwise
  // the feed leads and the store is only a fallback for tickers Parqet misses.
  const stored = uploadKey ? logoImgUrl(uploadKey, bust || undefined) : ''
  const parqet = sym
    ? `https://assets.parqet.com/logos/symbol/${encodeURIComponent(sym)}?size=128`
    : ''
  const storeFirst = bust > 0 || hasUpload === true
  const sources = (storeFirst ? [stored, parqet] : [parqet, stored]).filter(Boolean)

  // Reset to the top of the chain whenever the candidates change (the same
  // instance renders different instruments as the advisor navigates).
  const chainKey = sources.join('|')
  const [idx, setIdx] = useState(0)
  useEffect(() => setIdx(0), [chainKey])

  const current = sources[idx] ?? ''
  const showingUploaded = !!current && current === stored && (hasUpload === true || bust > 0)

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !uploadKey) return
    setBusy(true)
    try {
      await uploadLogo(uploadKey, file)
      setHasUpload(true)
      setBust(Date.now()) // lead with the store and defeat the image cache
    } catch {
      /* leave the current logo in place */
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async () => {
    if (!uploadKey) return
    setBusy(true)
    try {
      await deleteLogo(uploadKey)
      setHasUpload(false)
      setBust(0) // fall back to the feed / monogram
    } catch {
      /* keep what's showing */
    } finally {
      setBusy(false)
    }
  }

  const chip = current ? (
    // Real logos are drawn for light backgrounds — a white chip reads in either theme.
    <div
      className="grid place-items-center overflow-hidden rounded-2xl border border-border bg-white shadow-soft"
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
  ) : (
    <div
      className="grid place-items-center rounded-2xl border border-border bg-surface2"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="font-serif font-semibold text-muted" style={{ fontSize: size * 0.34 }}>
        {monogram(name)}
      </span>
    </div>
  )

  if (!canUpload || !uploadKey) return <div className="shrink-0">{chip}</div>

  const action = busy
    ? '…'
    : current
      ? pick(lang, 'Replace', 'Reemplazar')
      : pick(lang, 'Upload logo', 'Subir logo')

  return (
    <div className="no-print shrink-0" style={{ width: size }}>
      {chip}
      <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] leading-none">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="text-muted transition-colors hover:text-teal disabled:opacity-50"
        >
          {action}
        </button>
        {showingUploaded && !busy && (
          <>
            <span aria-hidden className="text-faint">
              ·
            </span>
            <button
              type="button"
              onClick={onRemove}
              className="text-muted transition-colors hover:text-red"
            >
              {pick(lang, 'Remove', 'Quitar')}
            </button>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
        aria-label={pick(lang, 'Upload a logo', 'Subir un logo')}
      />
    </div>
  )
}
