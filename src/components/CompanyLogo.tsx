import { useState } from 'react'

// Company / asset logo. Parqet serves logos by ticker symbol with no domain
// lookup needed — equities via /logos/symbol, crypto via /logos/crypto. Unknown
// symbols 404, so on error (or when there's no ticker) we fall back to a
// monogram of the name's initials on a paper chip that matches the theme.
type Props = {
  ticker?: string
  name: string
  isCrypto?: boolean
  size?: number
}

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

export default function CompanyLogo({ ticker, name, isCrypto = false, size = 64 }: Props) {
  const sym = (ticker ?? '').trim().toUpperCase()
  const [failed, setFailed] = useState(false)
  const showImg = !!sym && !failed
  const kind = isCrypto ? 'crypto' : 'symbol'
  const src = `https://assets.parqet.com/logos/${kind}/${encodeURIComponent(sym)}?size=128`

  if (!showImg) {
    return (
      <div
        className="grid shrink-0 place-items-center rounded-2xl border border-border bg-surface2"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <span className="font-serif font-semibold text-muted" style={{ fontSize: size * 0.34 }}>
          {monogram(name)}
        </span>
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
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-2"
      />
    </div>
  )
}
