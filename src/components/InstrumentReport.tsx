import { useEffect, useState } from 'react'
import { type Region } from '../lib/instruments'
import { assignedLevel } from '../lib/portfolio'
import { issuerProfile, type IssuerProfile } from '../lib/issuer'
import {
  companyKeyFor,
  fieldSpecsFor,
  kindLabel,
  localizedDetail,
  type FieldSpec,
  type ManagedInstrument,
} from '../lib/catalog'
import { useLang, useT } from '../i18n/i18n'
import { categoryLabel } from '../i18n/content'
import CompanyLogo from './CompanyLogo'
import InstrumentDocs from './InstrumentDocs'

type Props = {
  instrument: ManagedInstrument
  region: Region
  onBack: () => void
  /**
   * Fill the parent box instead of sizing to content: the green header stays
   * put and only the body scrolls. Used by the advisor's full-screen ficha;
   * InstrumentList renders the same report inline, where content height is right.
   */
  fill?: boolean
}

const HEADER_GREEN = '#12463a'

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

// Valuation / return metrics go in "Métricas"; everything else is "Datos".
const METRIC_KEYS = new Set([
  'lastPrice', 'change1Y', 'priceTarget', 'potentialReturn', 'peRatio', 'peForward',
  'beta', 'impliedVol3m', 'marketCapAum', 'marketCap', 'ytmBid', 'ytmAsk', 'ytc',
  'couponRate', 'dividendYield', 'estYield', 'expenseRatio', 'impliedInflation', 'spread',
])
// Fields surfaced in the header / prose / graphics — never repeated in the lists.
const NARRATIVE_KEYS = new Set(['rationale', 'description', 'kind', 'sectorIndex', 'sector', 'asOf', 'name'])

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{children}</h4>
}

// A card holding a title + a label/value list.
function KVCard({ title, specs, D, lang }: { title: string; specs: FieldSpec[]; D: Record<string, string>; lang: 'en' | 'es' }) {
  if (specs.length === 0) return null
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <SectionTitle>{title}</SectionTitle>
      <dl className="mt-3">
        {specs.map((s) => (
          <div key={s.key} className="flex items-baseline justify-between gap-4 border-b border-border/50 py-2 last:border-0">
            <dt className="text-sm text-muted">{lang === 'es' ? s.es : s.en}</dt>
            <dd className="text-right font-mono text-sm font-medium text-text tnum">{localizedDetail(D, s.key, lang)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// The 1–5 risk indicator: a low→high gradient with a marker on the assigned level.
function RiskLevelGauge({ level }: { level: number }) {
  const td = useT().instrumentDetail
  const pos = ((Math.max(1, Math.min(5, level)) - 1) / 4) * 100
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
        <span>{td.riskLow}</span>
        <span>{td.riskHigh}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#3FA97F,#8DBF5A,#E0B93C,#E08A3C,#E05C5C)' }}>
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-text bg-surface shadow-soft"
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`font-mono text-xs tnum ${n === level ? 'font-semibold text-text' : 'text-muted'}`}>
            {n}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function InstrumentReport({ instrument: inst, region, onBack, fill = false }: Props) {
  const t = useT()
  const { lang } = useLang()
  const td = t.instrumentDetail
  const D = inst.details
  const g = (k: string) => (D[k] ?? '').trim()

  // An individual bond gets its logo + blurb from the ISSUER's listed equity.
  const issuerName = g('issuer')
  const [issuer, setIssuer] = useState<IssuerProfile | null>(null)
  useEffect(() => {
    if (inst.ticker || !issuerName || region !== 'global') {
      setIssuer(null)
      return
    }
    let alive = true
    void issuerProfile(issuerName).then((p) => alive && setIssuer(p))
    return () => {
      alive = false
    }
  }, [inst.ticker, issuerName, region])
  const issuerDescription = (lang === 'es' ? issuer?.descriptionEs || issuer?.description : issuer?.description) ?? ''

  const rationale = g('rationale')
  const description = localizedDetail(D, 'description', lang) || issuerDescription
  const sector = localizedDetail(D, 'sectorIndex', lang) || localizedDetail(D, 'sector', lang)
  const specs = fieldSpecsFor(region, inst.assetClass, inst.kind)
  const shownKeys = new Set(specs.map((s) => s.key))
  const has = (k: string) => g(k) !== '' && shownKeys.has(k)

  const metricSpecs = specs.filter((s) => METRIC_KEYS.has(s.key) && g(s.key) !== '')
  const dataSpecs = specs.filter((s) => !METRIC_KEYS.has(s.key) && !NARRATIVE_KEYS.has(s.key) && g(s.key) !== '')

  const logoTicker = inst.ticker || issuer?.ticker || ''
  const logoName = inst.ticker ? inst.name : issuerName || inst.name
  const logoUploadKey = companyKeyFor(inst) || (logoTicker ? logoTicker.toLowerCase() : '')

  const asOf = g('asOf')
  const breadcrumb = [categoryLabel(inst.assetClass, region, lang), inst.kind && kindLabel(inst.kind, lang, region, inst.assetClass), sector].filter(Boolean).join(' · ')
  const idLine = [inst.ticker || inst.isin, g('fundManager')].filter(Boolean).join(' · ')

  // ── price vs 52-week range ─────────────────────────────────────────────────
  const range = parseRange(g('range52w'))
  const nowPx = toNum(g('lastPrice'))
  const targetPx = toNum(g('priceTarget'))
  const showRange = !!range && nowPx != null && has('range52w')
  let posLow = 0, posHigh = 100, posNow = 50, posTarget: number | null = null
  if (showRange && range) {
    const lo = Math.min(range.low, nowPx as number, targetPx ?? range.low)
    const hi = Math.max(range.high, nowPx as number, targetPx ?? range.high)
    const span = hi - lo || 1
    const at = (v: number) => clamp(((v - lo) / span) * 100, 0, 100)
    posLow = at(range.low); posHigh = at(range.high); posNow = at(nowPx as number)
    posTarget = targetPx != null ? at(targetPx) : null
  }

  // ── analyst consensus ──────────────────────────────────────────────────────
  const buy = toNum(g('recBuyPct'))
  const hold = toNum(g('recHoldPct'))
  const sell = toNum(g('recSellPct'))
  const showConsensus = buy != null && has('recBuyPct')

  return (
    <div
      className={
        // `fill` = live inside a fixed-height box (the advisor's overlay): the
        // header stays put and the body is the only scroller. Otherwise the card
        // is as tall as its content and the page scrolls.
        fill
          ? 'flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-card'
          : 'animate-fade-300 overflow-hidden rounded-3xl border border-border bg-surface shadow-card'
      }
    >
      {/* ── Green header band ─────────────────────────────────────────────────── */}
      <div className="relative shrink-0 px-6 py-6 text-white sm:px-8" style={{ backgroundColor: HEADER_GREEN }}>
        <button
          type="button"
          onClick={onBack}
          aria-label={td.backToList}
          className="no-print absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        >
          ✕
        </button>
        <div className="flex items-start gap-4 pr-10">
          <CompanyLogo ticker={logoTicker} name={logoName} uploadKey={logoUploadKey} canUpload size={52} />
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">{breadcrumb}</p>
            <h3 className="mt-1.5 font-serif text-3xl font-semibold leading-tight">{inst.name}</h3>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 font-mono text-xs text-white/70">
              {idLine}
              {inst.emphasized && (
                <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white">★ {td.housePick}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Body: narrative (left) + metrics/data (right) ─────────────────────── */}
      {/* When filling the viewport the body is the scroller, and the wider box
          earns a third column for the metric cards instead of one long one. */}
      <div
        className={`grid grid-cols-1 gap-6 p-6 sm:p-8 min-[820px]:grid-cols-[1.5fr_1fr] ${
          fill ? 'min-h-0 flex-1 overflow-y-auto min-[1280px]:grid-cols-[1.35fr_1fr]' : ''
        }`}
      >
        {/* LEFT */}
        <div className="min-w-0 space-y-7">
          {description && (
            <section>
              <SectionTitle>{td.objective}</SectionTitle>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-text">{description}</p>
            </section>
          )}

          {rationale && (
            <section>
              <SectionTitle>{td.whyRecommend}</SectionTitle>
              <div className="mt-3 rounded-2xl border border-teal/25 bg-teal/[0.06] p-5">
                <p className="text-[15px] font-medium leading-relaxed text-text">{rationale}</p>
              </div>
            </section>
          )}

          {showRange && range && (
            <section>
              <SectionTitle>{td.priceVsRange}</SectionTitle>
              <div className="mt-4">
                <div className="relative h-2 rounded-full bg-surface2">
                  <div className="absolute h-2 rounded-full bg-teal/25" style={{ left: `${posLow}%`, width: `${posHigh - posLow}%` }} />
                  {posTarget != null && (
                    <div className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal" style={{ left: `${posTarget}%` }} />
                  )}
                  <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-text shadow-soft" style={{ left: `${posNow}%` }} />
                </div>
                <div className="mt-2.5 flex justify-between font-mono text-[11px] text-muted tnum">
                  <span>{td.low} {range.low.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span>{td.high} {range.high.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] tnum">
                  <span className="flex items-center gap-1.5 text-text"><span className="inline-block h-2.5 w-2.5 rounded-full bg-text" /> {td.now} ${g('lastPrice')}</span>
                  {targetPx != null && (
                    <span className="flex items-center gap-1.5 text-teal"><span className="inline-block h-3 w-[3px] rounded-full bg-teal" /> {td.target} ${g('priceTarget')}</span>
                  )}
                </div>
              </div>
            </section>
          )}

          {showConsensus && (
            <section>
              <SectionTitle>{td.consensus}</SectionTitle>
              <div className="mt-4">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-surface2">
                  <div className="bg-teal" style={{ width: `${clamp(buy ?? 0, 0, 100)}%` }} />
                  <div className="bg-amber" style={{ width: `${clamp(hold ?? 0, 0, 100)}%` }} />
                  <div className="bg-red" style={{ width: `${clamp(sell ?? 0, 0, 100)}%` }} />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tnum">
                  <span className="flex items-center gap-1.5 text-teal"><span className="inline-block h-2.5 w-2.5 rounded-full bg-teal" /> {td.buy} {g('recBuyPct')}</span>
                  {hold != null && <span className="flex items-center gap-1.5 text-amber"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber" /> {td.hold} {g('recHoldPct')}</span>}
                  {sell != null && <span className="flex items-center gap-1.5 text-red"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red" /> {td.sell} {g('recSellPct')}</span>}
                  {g('analystCount') && <span className="text-muted">· {td.analystsCovering(g('analystCount'))}</span>}
                </div>
              </div>
            </section>
          )}

          <InstrumentDocs instrumentId={inst.id} editable={false} />
        </div>

        {/* RIGHT — on a wide full-screen ficha the rail splits into two columns
            so the metrics sit beside the fund data instead of far below it. */}
        <div className={fill ? 'grid content-start gap-4 min-[1280px]:grid-cols-2' : 'space-y-4'}>
          {/* Risk indicator */}
          <div className={`rounded-2xl border border-border bg-surface p-5 shadow-soft ${fill ? 'min-[1280px]:col-span-2' : ''}`}>
            <SectionTitle>{td.riskIndicator}</SectionTitle>
            <div className="mt-4">
              <RiskLevelGauge level={assignedLevel(inst)} />
            </div>
          </div>

          <KVCard title={td.metricsTitle} specs={metricSpecs} D={D} lang={lang} />
          <KVCard title={td.fundData} specs={dataSpecs} D={D} lang={lang} />

          {/* Liquidity / lock-up */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <div className="flex gap-8">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{td.liquidityTier}</p>
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

          {asOf && (
            <p className={`px-1 font-mono text-[11px] text-faint ${fill ? 'min-[1280px]:col-span-2' : ''}`}>{td.asOf(asOf)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
