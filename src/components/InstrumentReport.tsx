import { colorForCategory, type Region } from '../lib/instruments'
import {
  fieldSpecsFor,
  kindLabel,
  localizedDetail,
  type ManagedInstrument,
} from '../lib/catalog'
import { useLang, useT } from '../i18n/i18n'
import CompanyLogo from './CompanyLogo'
import InstrumentDocs from './InstrumentDocs'

type Props = {
  instrument: ManagedInstrument & { fit: number }
  region: Region
  onBack: () => void
}

// ── numeric parsing off the stored formatted strings ─────────────────────────
const toNum = (s?: string): number | null => {
  if (s == null) return null
  const cleaned = String(s).replace(/−/g, '-').replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}
const parseRange = (s?: string): { low: number; high: number } | null => {
  if (!s) return null
  const parts = s.split(/\s[–—-]\s/)
  if (parts.length < 2) return null
  const low = toNum(parts[0])
  const high = toNum(parts[1])
  return low != null && high != null && high > low ? { low, high } : null
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
// Positive → viridian, negative → red, flat → muted. Matches the app's polarity.
const signClass = (s?: string): string => {
  const n = toNum(s)
  if (n == null) return 'text-text'
  return n > 0 ? 'text-teal' : n < 0 ? 'text-red' : 'text-muted'
}

// ── small presentational pieces ──────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{children}</h4>
  )
}

function FitRing({
  value,
  band,
  label,
}: {
  value: number
  band: { stroke: string; text: string }
  label: string
}) {
  const size = 96
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (clamp(value, 0, 100) / 100) * c
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={band.stroke}
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-mono text-2xl font-semibold tnum ${band.text}`}>
            {Math.round(value)}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted">/ 100</span>
        </div>
      </div>
      <span className={`mt-1.5 text-xs font-medium ${band.text}`}>{label}</span>
    </div>
  )
}

function StatTile({
  label,
  value,
  valueClass = 'text-text',
  sub,
  subClass = 'text-muted',
}: {
  label: string
  value: string
  valueClass?: string
  sub?: string
  subClass?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg/50 px-4 py-3.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1.5 font-mono text-xl font-semibold tnum ${valueClass}`}>{value}</p>
      {sub && <p className={`mt-0.5 font-mono text-xs tnum ${subClass}`}>{sub}</p>}
    </div>
  )
}

// A greek from the risk vector as a signed meter centered at zero.
function Greek({ sym, value }: { sym: string; value: number }) {
  const pct = clamp(Math.abs(value), 0, 1) * 50
  const positive = value >= 0
  return (
    <div className="min-w-[92px] flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm text-text">{sym}</span>
        <span className="font-mono text-sm text-text tnum">
          {positive ? '+' : '−'}
          {Math.abs(value).toFixed(2)}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-surface2">
        <div className="absolute left-1/2 top-[-2px] h-[calc(100%+4px)] w-px bg-border" />
        <div
          className={`absolute top-0 h-1.5 rounded-full ${positive ? 'bg-teal' : 'bg-amber'}`}
          style={{ left: positive ? '50%' : `${50 - pct}%`, width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function InstrumentReport({ instrument: inst, region, onBack }: Props) {
  const t = useT()
  const { lang } = useLang()
  const td = t.instrumentDetail
  const D = inst.details
  const g = (k: string) => (D[k] ?? '').trim()
  const isCrypto = inst.assetClass === 'Crypto'

  const rationale = g('rationale')
  const description = localizedDetail(D, 'description', lang)
  const sector = localizedDetail(D, 'sectorIndex', lang)
  const specs = fieldSpecsFor(region, inst.assetClass)

  // Fit band.
  const fit = inst.fit
  const band =
    fit >= 80
      ? { stroke: 'stroke-teal', text: 'text-teal', label: td.fitStrong }
      : fit >= 60
        ? { stroke: 'stroke-teal', text: 'text-teal', label: td.fitGood }
        : fit >= 40
          ? { stroke: 'stroke-amber', text: 'text-amber', label: td.fitModerate }
          : { stroke: 'stroke-red', text: 'text-red', label: td.fitWeak }

  // Keys surfaced in the header / prose / graphics never repeat in the grid.
  const consumed = new Set<string>([
    'rationale',
    'description',
    'kind',
    'sectorIndex',
    'exchange',
    'asOf',
    'name',
  ])

  // ── headline tiles: first four that have data (adapts per asset class) ───────
  type Tile = { label: string; value: string; valueClass?: string; sub?: string; subClass?: string; consumes: string[] }
  const cand: (Tile | false)[] = [
    !!g('lastPrice') && {
      label: td.price,
      value: `$${g('lastPrice')}`,
      sub: g('change1Y') ? `${g('change1Y')} · 1Y` : undefined,
      subClass: signClass(g('change1Y')),
      consumes: ['lastPrice', 'change1Y'],
    },
    !!g('priceTarget') && {
      label: td.priceTarget,
      value: `$${g('priceTarget')}`,
      sub: g('potentialReturn') || undefined,
      subClass: signClass(g('potentialReturn')),
      consumes: ['priceTarget', 'potentialReturn'],
    },
    !!(g('marketCapAum') || g('marketCap')) && {
      label: td.marketCap,
      value: g('marketCapAum') || g('marketCap'),
      consumes: ['marketCapAum', 'marketCap'],
    },
    !!g('ytmBid') || !!g('ytmAsk')
      ? { label: td.yieldYtm, value: g('ytmBid') || g('ytmAsk'), valueClass: 'text-teal', consumes: ['ytmBid', 'ytmAsk'] }
      : false,
    !!g('couponRate') && { label: td.coupon, value: g('couponRate'), consumes: ['couponRate'] },
    !!g('creditRating') && { label: td.rating, value: g('creditRating'), consumes: ['creditRating'] },
    !!g('maturity') && { label: td.maturity, value: g('maturity'), consumes: ['maturity'] },
    !!g('dividendYield') && { label: specLabel('dividendYield'), value: g('dividendYield'), consumes: ['dividendYield'] },
    !!g('peForward') && { label: specLabel('peForward'), value: g('peForward'), consumes: ['peForward'] },
    !!g('impliedVol3m') && { label: td.impliedVol, value: g('impliedVol3m'), consumes: ['impliedVol3m'] },
  ]
  function specLabel(key: string): string {
    const s = specs.find((x) => x.key === key)
    return s ? (lang === 'es' ? s.es : s.en) : key
  }
  const tiles = cand.filter(Boolean).slice(0, 4) as Tile[]
  tiles.forEach((tl) => tl.consumes.forEach((k) => consumed.add(k)))

  // ── 52-week range graphic ────────────────────────────────────────────────
  const range = parseRange(g('range52w'))
  const nowPx = toNum(g('lastPrice'))
  const targetPx = toNum(g('priceTarget'))
  const showRange = !!range && nowPx != null
  if (showRange) consumed.add('range52w')

  // ── analyst consensus graphic ────────────────────────────────────────────
  const buy = toNum(g('recBuyPct'))
  const hold = toNum(g('recHoldPct'))
  const sell = toNum(g('recSellPct'))
  const showConsensus = buy != null
  if (showConsensus) ['recBuyPct', 'recHoldPct', 'recSellPct', 'analystCount'].forEach((k) => consumed.add(k))

  // ── remaining fundamentals ────────────────────────────────────────────────
  const gridSpecs = specs.filter((s) => !consumed.has(s.key) && g(s.key) !== '')

  const accent = colorForCategory(inst.assetClass, region)
  const asOf = g('asOf')

  // range positions
  let posLow = 0,
    posHigh = 100,
    posNow = 50,
    posTarget: number | null = null
  if (showRange && range) {
    const lo = Math.min(range.low, nowPx as number, targetPx ?? range.low)
    const hi = Math.max(range.high, nowPx as number, targetPx ?? range.high)
    const span = hi - lo || 1
    const at = (v: number) => clamp(((v - lo) / span) * 100, 0, 100)
    posLow = at(range.low)
    posHigh = at(range.high)
    posNow = at(nowPx as number)
    posTarget = targetPx != null ? at(targetPx) : null
  }

  return (
    <div className="animate-fade-300">
      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="no-print mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <span aria-hidden>‹</span> {td.backToList}
      </button>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <CompanyLogo ticker={inst.ticker} name={inst.name} isCrypto={isCrypto} size={64} />
          <div className="min-w-0">
            <h3 className="font-serif text-2xl font-semibold leading-tight text-text">{inst.name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
              {inst.ticker && <span className="text-text">{inst.ticker}</span>}
              {g('exchange') && (
                <>
                  <span aria-hidden>·</span>
                  <span>{g('exchange')}</span>
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {inst.kind && (
                <span className="rounded-md bg-surface2 px-2 py-0.5 text-[11px] font-medium text-muted">
                  {kindLabel(inst.kind, lang)}
                </span>
              )}
              {sector && (
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: `${accent}1f`, color: accent }}
                >
                  {sector}
                </span>
              )}
              {inst.emphasized && (
                <span className="rounded-md bg-teal/12 px-2 py-0.5 text-[11px] font-medium text-teal">
                  ★ {td.housePick}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:flex-col sm:items-center">
          <FitRing value={fit} band={band} label={band.label} />
        </div>
      </div>

      {/* ── Thesis ──────────────────────────────────────────────────────────── */}
      {rationale && (
        <div className="mt-6 rounded-2xl border border-teal/25 bg-teal/[0.06] p-5">
          <SectionTitle>{td.whyRecommend}</SectionTitle>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-text">{rationale}</p>
        </div>
      )}

      {/* ── Headline tiles ──────────────────────────────────────────────────── */}
      {tiles.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((tl) => (
            <StatTile
              key={tl.label}
              label={tl.label}
              value={tl.value}
              valueClass={tl.valueClass}
              sub={tl.sub}
              subClass={tl.subClass}
            />
          ))}
        </div>
      )}

      {/* ── Price vs 52-week range ──────────────────────────────────────────── */}
      {showRange && range && (
        <section className="mt-8">
          <SectionTitle>{td.priceVsRange}</SectionTitle>
          <div className="mt-4">
            <div className="relative h-2 rounded-full bg-surface2">
              <div
                className="absolute h-2 rounded-full bg-teal/25"
                style={{ left: `${posLow}%`, width: `${posHigh - posLow}%` }}
              />
              {posTarget != null && (
                <div
                  className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal"
                  style={{ left: `${posTarget}%` }}
                />
              )}
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-text shadow-soft"
                style={{ left: `${posNow}%` }}
              />
            </div>
            <div className="mt-2.5 flex justify-between font-mono text-[11px] text-muted tnum">
              <span>
                {td.low} {range.low.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span>
                {td.high} {range.high.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] tnum">
              <span className="flex items-center gap-1.5 text-text">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-text" /> {td.now} ${g('lastPrice')}
              </span>
              {targetPx != null && (
                <span className="flex items-center gap-1.5 text-teal">
                  <span className="inline-block h-3 w-[3px] rounded-full bg-teal" /> {td.target} ${g('priceTarget')}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Analyst consensus ───────────────────────────────────────────────── */}
      {showConsensus && (
        <section className="mt-8">
          <SectionTitle>{td.consensus}</SectionTitle>
          <div className="mt-4">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface2">
              <div className="bg-teal" style={{ width: `${clamp(buy ?? 0, 0, 100)}%` }} />
              <div className="bg-amber" style={{ width: `${clamp(hold ?? 0, 0, 100)}%` }} />
              <div className="bg-red" style={{ width: `${clamp(sell ?? 0, 0, 100)}%` }} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tnum">
              <span className="flex items-center gap-1.5 text-teal">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal" /> {td.buy} {g('recBuyPct')}
              </span>
              {hold != null && (
                <span className="flex items-center gap-1.5 text-amber">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber" /> {td.hold} {g('recHoldPct')}
                </span>
              )}
              {sell != null && (
                <span className="flex items-center gap-1.5 text-red">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red" /> {td.sell} {g('recSellPct')}
                </span>
              )}
              {g('analystCount') && (
                <span className="text-muted">· {td.analystsCovering(g('analystCount'))}</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── About ───────────────────────────────────────────────────────────── */}
      {description && (
        <section className="mt-8">
          <SectionTitle>{td.about}</SectionTitle>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>
        </section>
      )}

      {/* ── Fundamentals ────────────────────────────────────────────────────── */}
      {gridSpecs.length > 0 && (
        <section className="mt-8">
          <SectionTitle>{td.fundamentals}</SectionTitle>
          <dl className="mt-3 grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
            {gridSpecs.map((s) => (
              <div
                key={s.key}
                className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2.5"
              >
                <dt className="text-sm text-muted">{lang === 'es' ? s.es : s.en}</dt>
                <dd className="text-right font-mono text-sm font-medium text-text tnum">
                  {localizedDetail(D, s.key, lang)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ── Suitability ─────────────────────────────────────────────────────── */}
      <section className="mt-8 rounded-2xl border border-border bg-surface2/30 p-5">
        <SectionTitle>{td.suitability}</SectionTitle>
        <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-4">
          <div className="flex flex-1 flex-wrap gap-x-5 gap-y-3">
            <Greek sym="σ" value={inst.sigmaLoad} />
            <Greek sym="α" value={inst.alphaLoad} />
            <Greek sym="λ" value={inst.lambdaLoad} />
          </div>
          <div className="flex gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                {td.liquidityTier}
              </p>
              <p className="mt-1 font-mono text-sm text-text tnum">{inst.liquidityTier}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{td.lockup}</p>
              <p className="mt-1 font-mono text-sm text-text tnum">
                {inst.lockupMonths > 0 ? `${inst.lockupMonths} ${td.months}` : td.tradeable}
              </p>
            </div>
          </div>
        </div>
      </section>

      <InstrumentDocs instrumentId={inst.id} editable={false} />

      {asOf && <p className="mt-4 font-mono text-[11px] text-faint">{td.asOf(asOf)}</p>}
    </div>
  )
}
