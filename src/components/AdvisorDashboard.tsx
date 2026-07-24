import { useMemo, useState } from 'react'
import { type DashboardData, type RiskLevel } from '../lib/scoring'
import { colorForCategory, type Category, type Region } from '../lib/instruments'
import { bandForLevel, useRiskBands } from '../lib/bandConfig'
import { useCatalog, type ManagedInstrument } from '../lib/catalog'
import { usePortfolioModel } from '../lib/portfolioModelConfig'
import {
  allocateCapital,
  assemblePortfolio,
  buildPortfolio,
  estimate,
  holdingsFromWeights,
  type Estimate,
  type Holding,
  type Portfolio,
} from '../lib/portfolio'
import { useLang, useT } from '../i18n/i18n'
import { bandColor, categoryLabel, localizedBand, regionLabel } from '../i18n/content'
import DonutChart from './DonutChart'
import RiskReturnScatter from './RiskReturnScatter'
import InstrumentReport from './InstrumentReport'

type Props = { data: DashboardData; clientName: string | null }
type Weight = { instId: string; weight: number }
type SortKey = 'level' | 'return' | 'vol' | 'name'

const RISK_COLORS: Record<RiskLevel, string> = { 1: '#3FA97F', 2: '#8DBF5A', 3: '#E0B93C', 4: '#E08A3C', 5: '#E05C5C' }
const pctFmt = (x: number, dp = 1) => `${(x * 100).toFixed(dp)}%`
const cardCls = 'rounded-2xl border border-border bg-surface shadow-soft'

function LevelChip({ level }: { level: RiskLevel }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold" style={{ backgroundColor: `${RISK_COLORS[level]}22`, color: RISK_COLORS[level] }}>
      {level}
    </span>
  )
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-soft">
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-medium tnum" style={accent ? { color: accent } : undefined}>{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  )
}

export default function AdvisorDashboard({ data, clientName }: Props) {
  const t = useT()
  const { lang } = useLang()
  const { config } = useRiskBands()
  const { instruments } = useCatalog()
  const { model } = usePortfolioModel()

  const [region, setRegion] = useState<Region>('global')
  const [working, setWorking] = useState<Weight[] | null>(null) // null = suggested
  const [ficha, setFicha] = useState<ManagedInstrument | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('level')
  const [classFilter, setClassFilter] = useState<Category | 'all'>('all')
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [capital, setCapital] = useState(100_000)

  const band = localizedBand(data.level, lang)
  const preset = bandForLevel(config, data.level)
  const color = bandColor(data.level)
  const mix = region === 'global' ? preset.mix : preset.localMix
  const isLocal = region === 'local'
  const currency = isLocal ? '₲' : '$'
  const money = (n: number) => `${currency}${Math.round(n).toLocaleString('en-US')}`

  // Suggested portfolio (optimizer) — the starting point.
  const suggested = useMemo(
    () => buildPortfolio(region, mix, instruments, data.scores, data.level),
    [region, mix, instruments, data.scores, data.level, model],
  )
  // Working portfolio = suggested, or the advisor's edits.
  const portfolio: Portfolio = useMemo(
    () => (working ? assemblePortfolio(holdingsFromWeights(working, instruments, data.scores), region) : suggested),
    [working, suggested, instruments, data.scores, region, model],
  )
  const heldIds = new Set(portfolio.holdings.map((h) => h.inst.id))
  const rawTotal = working ? working.reduce((a, w) => a + w.weight, 0) : 1

  // Master list — every visible instrument for this region, estimated.
  const masterAll = useMemo<Estimate[]>(
    () => instruments.filter((i) => (i.region ?? 'global') === region && i.visible).map((i) => estimate(i, data.scores)),
    [instruments, region, data.scores, model],
  )
  const classes = useMemo(() => [...new Set(masterAll.map((e) => e.inst.assetClass))], [masterAll])
  const master = useMemo(() => {
    const q = search.trim().toLowerCase()
    const f = masterAll
      .filter((e) => classFilter === 'all' || e.inst.assetClass === classFilter)
      .filter((e) => !q || e.inst.name.toLowerCase().includes(q) || e.inst.ticker.toLowerCase().includes(q))
    const cmp: Record<SortKey, (a: Estimate, b: Estimate) => number> = {
      level: (a, b) => a.riskLevel - b.riskLevel || b.expReturn - a.expReturn,
      return: (a, b) => b.expReturn - a.expReturn,
      vol: (a, b) => a.vol - b.vol,
      name: (a, b) => a.inst.name.localeCompare(b.inst.name),
    }
    return f.slice().sort(cmp[sortKey])
  }, [masterAll, classFilter, search, sortKey])

  // ── mutations ──────────────────────────────────────────────────────────────
  const ensure = (): Weight[] => working ?? suggested.holdings.map((h) => ({ instId: h.inst.id, weight: h.weight }))
  const addInstrument = (id: string) => {
    setWorking((w) => {
      const base = w ?? suggested.holdings.map((h) => ({ instId: h.inst.id, weight: h.weight }))
      if (base.some((x) => x.instId === id)) return base
      const avg = base.length ? base.reduce((a, x) => a + x.weight, 0) / base.length : 0.1
      return [...base, { instId: id, weight: avg || 0.05 }]
    })
  }
  const removeInstrument = (id: string) => setWorking(() => ensure().filter((x) => x.instId !== id))
  const setWeight = (id: string, pct: number) =>
    setWorking(() => ensure().map((x) => (x.instId === id ? { ...x, weight: Math.max(0, pct / 100) } : x)))
  const resetSuggested = () => setWorking(null)
  const switchRegion = (r: Region) => {
    setRegion(r)
    setWorking(null)
    setClassFilter('all')
  }

  const plan = useMemo(() => allocateCapital(portfolio, capital), [portfolio, capital])
  const hasHoldings = portfolio.holdings.length > 0
  const classDonut = portfolio.classDist.map((c) => ({ assetClass: c.assetClass as Category, pct: c.weight }))
  const scatterPoints = portfolio.holdings.map((h) => ({ id: h.inst.id, name: h.inst.name, assetClass: h.inst.assetClass, vol: h.vol, ret: h.expReturn }))
  const riskDistMax = Math.max(1, ...([1, 2, 3, 4, 5] as RiskLevel[]).map((l) => portfolio.riskDist[l]))

  return (
    <div className="animate-fade-300 mx-auto w-full max-w-[1400px] px-4 pb-12 pt-4 min-[900px]:px-6">
      {/* ── Compact hero bar ──────────────────────────────────────────────────── */}
      <div className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${cardCls}`}>
        <span className="rounded-md bg-text px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bg">{t.common.advisorView}</span>
        <div className="min-w-0">
          <span className="text-lg font-semibold text-text">{clientName || t.dashboard.unnamed}</span>
          <span className="ml-2 text-sm text-muted">· {band.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="inline-flex rounded-full border border-border bg-surface p-0.5">
            {(['global', 'local'] as const).map((r) => (
              <button key={r} type="button" onClick={() => switchRegion(r)} className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${region === r ? 'bg-teal/15 text-teal shadow-soft' : 'text-muted hover:text-text'}`}>
                {regionLabel(r, lang)}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1" style={{ borderColor: `${color}55`, backgroundColor: `${color}10` }}>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted">{t.dashboard.riskLevel}</span>
            <span className="font-mono text-lg font-medium tnum" style={{ color }}>{data.level}<span className="text-xs text-muted">/5</span></span>
          </span>
        </div>
      </div>

      {/* ── Workspace: left (metrics + portfolio) · right (master list) ───────── */}
      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-[1fr_400px]">
        {/* LEFT */}
        <div className="order-2 flex min-w-0 flex-col gap-4 min-[1024px]:order-1">
          {/* Metrics */}
          <div className={`p-4 ${cardCls}`}>
            <div className="grid grid-cols-2 gap-2.5 min-[560px]:grid-cols-4">
              <StatTile label={t.portfolioPanel.expReturn} value={pctFmt(portfolio.expReturn)} sub={t.portfolioPanel.annualized} accent="rgb(var(--c-accent))" />
              <StatTile label={t.portfolioPanel.volatility} value={pctFmt(portfolio.vol)} sub={t.portfolioPanel.annualized} />
              <StatTile label={t.portfolioPanel.returnRisk} value={portfolio.sharpe.toFixed(2)} />
              <StatTile label={t.portfolioPanel.portfolioRisk} value={`${portfolio.riskLevel}/5`} accent={RISK_COLORS[portfolio.riskLevel]} />
            </div>
            {portfolio.bondStats && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 min-[560px]:grid-cols-4">
                <StatTile label={t.portfolioPanel.avgDuration} value={portfolio.bondStats.avgDuration.toFixed(1)} sub={t.portfolioPanel.years} />
                <StatTile label={t.portfolioPanel.bonds} value={String(portfolio.bondStats.count)} />
              </div>
            )}
            {hasHoldings && (
              <div className="mt-4 grid grid-cols-1 gap-4 min-[720px]:grid-cols-[1.3fr_1fr]">
                <RiskReturnScatter points={scatterPoints} region={region} title={t.portfolioPanel.scatterTitle} xLabel={t.portfolioPanel.scatterX} yLabel={t.portfolioPanel.scatterY} />
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-text">{t.portfolioPanel.byClass}</p>
                    <div className="flex items-center gap-3">
                      <DonutChart data={classDonut} size={110} region={region} />
                      <ul className="flex-1 space-y-1">
                        {classDonut.map((c) => (
                          <li key={c.assetClass} className="flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorForCategory(c.assetClass, region) }} />
                            <span className="flex-1 truncate text-text">{categoryLabel(c.assetClass, region, lang)}</span>
                            <span className="font-mono text-text tnum">{c.pct}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-text">{t.portfolioPanel.byRisk}</p>
                    <div className="space-y-1.5">
                      {([1, 2, 3, 4, 5] as RiskLevel[]).map((l) => (
                        <div key={l} className="flex items-center gap-2">
                          <LevelChip level={l} />
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                            <div className="h-full rounded-full" style={{ width: `${(portfolio.riskDist[l] / riskDistMax) * 100}%`, backgroundColor: RISK_COLORS[l] }} />
                          </div>
                          <span className="w-4 text-right font-mono text-xs text-muted tnum">{portfolio.riskDist[l]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Portfolio (drop zone) */}
          <div
            className={`p-4 transition-colors ${cardCls} ${dragOver ? 'ring-2 ring-teal/50' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) addInstrument(id) }}
          >
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-sm font-semibold text-text">{t.portfolioPanel.holdingsTitle}</h2>
              <span className={`font-mono text-xs tnum ${Math.abs(rawTotal - 1) < 0.005 ? 'text-muted' : 'text-amber'}`}>{t.portfolioPanel.total}: {Math.round(rawTotal * 100)}%</span>
              {working && (
                <button type="button" onClick={resetSuggested} className="ml-auto text-xs font-medium text-muted transition-colors hover:text-teal">{t.portfolioPanel.resetSuggested}</button>
              )}
            </div>
            {!hasHoldings ? (
              <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted">{t.portfolioPanel.dropHere}</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <tbody>
                    {portfolio.holdings.map((h) => (
                      <tr key={h.inst.id} className="border-b border-hairline last:border-0">
                        <td className="py-2 pl-3 pr-2">
                          <button type="button" onClick={() => setFicha(h.inst)} className="flex items-center gap-2 text-left">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorForCategory(h.inst.assetClass, region) }} />
                            <span className="truncate font-medium text-text hover:text-teal">{h.inst.name}</span>
                          </button>
                        </td>
                        <td className="px-1 py-2 text-center"><LevelChip level={h.riskLevel} /></td>
                        <td className="hidden px-2 py-2 text-right font-mono text-xs text-muted tnum sm:table-cell">{pctFmt(h.expReturn)}</td>
                        <td className="hidden px-2 py-2 text-right font-mono text-xs text-muted tnum sm:table-cell">{pctFmt(h.vol)}</td>
                        <td className="px-2 py-2 text-right">
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="number" min={0} max={100} step={1}
                              value={Math.round(h.weight * 100)}
                              onChange={(e) => setWeight(h.inst.id, Number(e.target.value) || 0)}
                              className="w-14 rounded-md border border-border bg-surface px-1.5 py-1 text-right font-mono text-xs text-text tnum outline-none focus:ring-2 focus:ring-teal/40"
                            />
                            <span className="text-xs text-muted">%</span>
                          </span>
                        </td>
                        <td className="pl-1 pr-2 text-right">
                          <button type="button" aria-label={t.portfolioPanel.remove} onClick={() => removeInstrument(h.inst.id)} className="rounded px-1.5 py-1 text-muted/60 transition-colors hover:bg-red/10 hover:text-red">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Capital planner */}
            {hasHoldings && (
              <div className="mt-4 border-t border-hairline pt-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <p className="text-sm font-semibold text-text">{t.portfolioPanel.capitalTitle}</p>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-muted">{currency}</span>
                    <input type="number" min={0} step={isLocal ? 1_000_000 : 1000} value={capital} onChange={(e) => setCapital(Math.max(0, Number(e.target.value) || 0))} className="w-36 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-sm text-text tnum outline-none focus:ring-2 focus:ring-teal/40" aria-label={t.portfolioPanel.capitalLabel} />
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted">{t.portfolioPanel.invested} <span className="text-text">{money(plan.invested)}</span> · {t.portfolioPanel.residual} <span className="text-teal">{money(plan.residual)}</span></span>
                </div>
                {plan.lines.filter((l) => l.units > 0).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {plan.lines.filter((l) => l.units > 0).map((l) => (
                      <span key={l.holding.inst.id} className="rounded-md border border-border bg-bg/50 px-2 py-1 font-mono text-[11px] text-muted tnum">
                        {l.units} <span className="text-text">{l.holding.inst.ticker && l.holding.inst.ticker !== 'OTC' ? l.holding.inst.ticker : l.holding.inst.name.slice(0, 14)}</span>
                      </span>
                    ))}
                  </div>
                )}
                {plan.unpriced.length > 0 && <p className="mt-2 text-[11px] text-muted">{t.portfolioPanel.unpricedNote(plan.unpriced.length)}</p>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: master list */}
        <div className="order-1 min-[1024px]:order-2">
          <div className={`flex flex-col p-4 min-[1024px]:sticky min-[1024px]:top-4 min-[1024px]:max-h-[calc(100vh-2rem)] ${cardCls}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text">{t.portfolioPanel.masterList}</h2>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-muted outline-none focus:ring-2 focus:ring-teal/40">
                <option value="level">{t.portfolioPanel.byLevel}</option>
                <option value="return">{t.portfolioPanel.byReturn}</option>
                <option value="vol">{t.portfolioPanel.byVol}</option>
                <option value="name">{t.portfolioPanel.byName}</option>
              </select>
            </div>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.portfolioPanel.searchPlaceholder} className="mb-2 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-teal/40" />
            <div className="mb-2 flex flex-wrap gap-1">
              {(['all', ...classes] as (Category | 'all')[]).map((c) => (
                <button key={c} type="button" onClick={() => setClassFilter(c)} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${classFilter === c ? 'bg-teal/15 text-teal' : 'text-muted hover:text-text'}`}>
                  {c === 'all' ? t.portfolioPanel.allClasses : categoryLabel(c, region, lang)}
                </button>
              ))}
            </div>
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              {master.map((e) => {
                const held = heldIds.has(e.inst.id)
                return (
                  <div
                    key={e.inst.id}
                    draggable
                    onDragStart={(ev) => ev.dataTransfer.setData('text/plain', e.inst.id)}
                    className="group flex cursor-grab items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-bg/50 active:cursor-grabbing"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorForCategory(e.inst.assetClass, region) }} />
                    <button type="button" onClick={() => setFicha(e.inst)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm text-text group-hover:text-teal">{e.inst.name}</span>
                      <span className="font-mono text-[10px] text-muted tnum">{t.portfolioPanel.ret} {pctFmt(e.expReturn)} · {t.portfolioPanel.vol} {pctFmt(e.vol)}</span>
                    </button>
                    <LevelChip level={e.riskLevel} />
                    <button
                      type="button"
                      aria-label={t.portfolioPanel.add}
                      onClick={() => addInstrument(e.inst.id)}
                      disabled={held}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-teal hover:text-teal disabled:opacity-30"
                    >
                      {held ? '✓' : '＋'}
                    </button>
                  </div>
                )
              })}
              {master.length === 0 && <p className="py-6 text-center text-sm text-muted">{t.instruments.noneInClass}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ficha modal ───────────────────────────────────────────────────────── */}
      {ficha && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={() => setFicha(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <InstrumentReport instrument={ficha} region={region} onBack={() => setFicha(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
