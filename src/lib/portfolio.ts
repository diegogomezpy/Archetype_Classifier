import { computeFitScore, type AxisScores, type RiskLevel } from './scoring'
import { deriveRiskLevel, volFromLevel } from './riskLevels'
import { type Category, type Region } from './instruments'
import type { ManagedInstrument } from './catalog'

// ---------------------------------------------------------------------------
// Portfolio construction
// ---------------------------------------------------------------------------
// The band fixes the % per asset class; within each class we optimize over the
// instruments nearest the client's risk level — mean-variance for equities, a
// yield/duration heuristic for bonds, level-weighting for the rest. Expected
// return / volatility / risk come from fields the catalog already carries.
// Everything downstream (advisor edits, manual weights) reuses assemblePortfolio.

// ── Tunable model (admin-editable, see lib/portfolioModelConfig) ─────────────
export type PortfolioModel = {
  rf: number // risk-free rate
  erp: number // equity risk premium (CAPM)
  analystBlend: number // weight on the analyst-target leg vs the CAPM leg (0..1)
  nameCap: number // max weight of a single name within its sleeve
  assetsPerClass: number // default instruments considered per class
  levelCeiling: number // exclude instruments more than this many levels above the client's band
  rhoWithin: number // correlation within an asset class
  rhoAcross: number // correlation across asset classes
  bandDuration: Record<RiskLevel, number> // target bond duration (years) per band
}

export const DEFAULT_PORTFOLIO_MODEL: PortfolioModel = {
  rf: 0.04,
  erp: 0.05,
  analystBlend: 0.5,
  nameCap: 0.35,
  assetsPerClass: 6,
  levelCeiling: 1,
  rhoWithin: 0.7,
  rhoAcross: 0.2,
  bandDuration: { 1: 2, 2: 3.5, 3: 5, 4: 6.5, 5: 8 },
}

let ACTIVE_MODEL: PortfolioModel = DEFAULT_PORTFOLIO_MODEL
export const setActivePortfolioModel = (m: PortfolioModel): void => {
  ACTIVE_MODEL = m
}
export const getPortfolioModel = (): PortfolioModel => ACTIVE_MODEL

// Vol inputs (not exposed — these describe the market, not the strategy).
const MARKET_VOL = 0.16 // broad-equity annualized vol, for beta fallback
const RATE_VOL = 0.009 // annualized vol per year of duration (rates)

// Class capital-market assumptions — the fallback expected return when an
// instrument carries no yield/target field of its own.
const CMA_RETURN: Record<string, number> = {
  Equities: 0.08,
  'Fixed income': 0.05,
  'Structured notes': 0.07,
  CDs: 0.06,
  'Mutual funds': 0.07,
  'Investment funds': 0.09,
}

// Credit-rating → extra annualized vol (credit component of bond risk).
const RATING_VOL: { re: RegExp; v: number }[] = [
  { re: /^AAA/i, v: 0.004 },
  { re: /^AA/i, v: 0.008 },
  { re: /^A(?![AB])/i, v: 0.014 },
  { re: /^BBB/i, v: 0.022 },
  { re: /^BB/i, v: 0.045 },
  { re: /^B(?![B])/i, v: 0.07 },
  { re: /^CCC|^CC|^C|^D/i, v: 0.11 },
]

// ── Parsing ──────────────────────────────────────────────────────────────────
export function parseNum(v: string | undefined): number | null {
  if (v == null) return null
  const m = String(v).replace(/\s/g, '').match(/-?[\d.,]+/)
  if (!m) return null
  let s = m[0]
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.') // 1.234,56 (European)
    else s = s.replace(/,/g, '') // 1,234.56 (US)
  } else if (lastComma !== -1) {
    s = s.replace(',', '.') // 5,43 → 5.43
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '') // 500.000 / 1.050 → European thousands
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}
function pct(v: string | undefined): number | null {
  const n = parseNum(v)
  return n == null ? null : n / 100
}

// ── Estimates ────────────────────────────────────────────────────────────────
export type Estimate = {
  inst: ManagedInstrument
  expReturn: number // annualized, fraction
  vol: number // annualized, fraction
  riskLevel: RiskLevel
  fit: number // internal ranking only (level-closeness to the client) — not shown
  unitPrice: number | null
  unitLabel: 'share' | 'bond' | 'unit'
}

function ratingVol(rating: string | undefined): number {
  if (!rating) return 0.02
  const hit = RATING_VOL.find((r) => r.re.test(rating.trim()))
  return hit ? hit.v : 0.02
}

function bondDuration(inst: ManagedInstrument): number | null {
  return parseNum(inst.details.duration) ?? parseNum(inst.details.residualYears)
}

// Market-implied annualized vol — ONLY the data-backed paths (undefined when the
// instrument carries none, so the level derivation stays non-circular).
function marketVol(inst: ManagedInstrument): number | undefined {
  const d = inst.details
  const cls = inst.assetClass
  if (cls === 'Equities') {
    const iv = pct(d.impliedVol3m)
    if (iv && iv > 0) return iv
    const beta = parseNum(d.beta)
    if (beta && beta > 0) return beta * MARKET_VOL
    return undefined
  }
  if (cls === 'Fixed income') {
    const dur = bondDuration(inst)
    if (dur && dur > 0) return dur * RATE_VOL + ratingVol(d.creditRating ?? d.rating)
    return undefined
  }
  return undefined
}

function resolveRiskLevel(inst: ManagedInstrument, mv: number | undefined): RiskLevel {
  if (inst.riskLevelOverride) return inst.riskLevelOverride
  const region = inst.region ?? 'global'
  return deriveRiskLevel(region, inst.assetClass, inst.details.creditRating ?? inst.details.rating, mv)
}

/** The instrument's assigned 1–5 level (exported for the fit call + display). */
export function assignedLevel(inst: ManagedInstrument): RiskLevel {
  return resolveRiskLevel(inst, marketVol(inst))
}

function estimateVol(inst: ManagedInstrument): number {
  return marketVol(inst) ?? volFromLevel(resolveRiskLevel(inst, undefined))
}

function estimateReturn(inst: ManagedInstrument): number {
  const M = ACTIVE_MODEL
  const d = inst.details
  const cls = inst.assetClass
  const region = inst.region ?? 'global'

  if (region === 'local') {
    const y = pct(d.estYield)
    return y != null ? y : CMA_RETURN[cls] ?? 0.06
  }
  if (cls === 'Equities') {
    let rAnalyst: number | null = pct(d.potentialReturn)
    if (rAnalyst == null) {
      const tgt = parseNum(d.priceTarget)
      const last = parseNum(d.lastPrice)
      if (tgt && last && last > 0) rAnalyst = tgt / last - 1
    }
    if (rAnalyst == null) {
      const dy = pct(d.dividendYield)
      if (dy != null) rAnalyst = dy + M.erp
    }
    if (rAnalyst != null) rAnalyst = Math.max(-0.5, Math.min(0.5, rAnalyst))
    const rCapm = M.rf + (parseNum(d.beta) ?? 1) * M.erp
    return rAnalyst != null ? M.analystBlend * rAnalyst + (1 - M.analystBlend) * rCapm : rCapm
  }
  if (cls === 'Fixed income') {
    const yb = pct(d.ytmBid)
    const ya = pct(d.ytmAsk)
    if (yb != null || ya != null) return Math.min(...[yb, ya].filter((x): x is number => x != null))
    const dy = pct(d.dividendYield)
    if (dy != null) return dy
    const cpn = pct(d.couponRate)
    if (cpn != null) return cpn
    return CMA_RETURN['Fixed income']
  }
  if (cls === 'Structured notes') {
    const cy = pct(d.couponYield)
    return cy != null ? cy : CMA_RETURN['Structured notes']
  }
  return CMA_RETURN[cls] ?? 0.06
}

// Annualized vol → a 1–5 risk level (portfolio aggregate).
export function riskBucket(vol: number): RiskLevel {
  if (vol < 0.04) return 1
  if (vol < 0.08) return 2
  if (vol < 0.13) return 3
  if (vol < 0.2) return 4
  return 5
}

function unitPriceOf(inst: ManagedInstrument): { price: number | null; label: 'share' | 'bond' | 'unit' } {
  const d = inst.details
  const cls = inst.assetClass
  if (cls === 'Equities') return { price: parseNum(d.lastPrice) ?? parseNum(d.price), label: 'share' }
  if (cls === 'Fixed income') {
    if (inst.kind === 'Bond ETF') return { price: parseNum(d.lastPrice), label: 'share' }
    const clean = parseNum(d.bid) ?? parseNum(d.ask)
    return { price: clean != null ? (clean / 100) * 1000 : null, label: 'bond' }
  }
  return { price: parseNum(d.price) ?? parseNum(d.minInvestment) ?? parseNum(d.shareValue), label: 'unit' }
}

export function estimate(inst: ManagedInstrument, scores: AxisScores): Estimate {
  const up = unitPriceOf(inst)
  const level = assignedLevel(inst)
  return {
    inst,
    expReturn: estimateReturn(inst),
    vol: estimateVol(inst),
    riskLevel: level,
    fit: computeFitScore(inst, scores, level),
    unitPrice: up.price && up.price > 0 ? up.price : null,
    unitLabel: up.label,
  }
}

// ── Sleeve optimizers (internal weights sum to 1) ────────────────────────────
function capWeights(w: number[], cap: number): number[] {
  let out = w.map((x) => Math.max(0, x))
  const s = out.reduce((a, b) => a + b, 0)
  if (s <= 0) return w.map(() => 1 / w.length)
  out = out.map((x) => x / s)
  for (let iter = 0; iter < 25; iter++) {
    if (!out.some((x) => x > cap + 1e-9)) break
    let excess = 0
    let underSum = 0
    out = out.map((x) => {
      if (x > cap) {
        excess += x - cap
        return cap
      }
      underSum += x
      return x
    })
    if (underSum <= 1e-9) break
    out = out.map((x) => (x < cap ? x + (x / underSum) * excess : x))
  }
  const t = out.reduce((a, b) => a + b, 0) || 1
  return out.map((x) => x / t)
}

function mvoWeights(mu: number[], sig: number[]): number[] {
  const M = ACTIVE_MODEL
  const n = mu.length
  if (n === 1) return [1]
  const rho = M.rhoWithin
  const y = mu.map((m, i) => (m - M.rf) / sig[i])
  const sumY = y.reduce((a, b) => a + b, 0)
  const c = rho / (1 + (n - 1) * rho)
  const z = y.map((yi) => (yi - c * sumY) / (1 - rho))
  const raw = z.map((zi, i) => zi / sig[i])
  if (raw.every((x) => x <= 0)) return capWeights(sig.map((s) => 1 / s), M.nameCap)
  return capWeights(raw, M.nameCap)
}

function bondWeights(est: Estimate[], level: RiskLevel): number[] {
  const M = ACTIVE_MODEL
  const targetDur = M.bandDuration[level]
  const durPenalty = 0.006 * (6 - level)
  const scores = est.map((e) => e.expReturn - durPenalty * Math.abs((bondDuration(e.inst) ?? targetDur) - targetDur))
  const hi = Math.max(...scores)
  const exps = scores.map((s) => Math.exp((s - hi) / 0.02))
  const t = exps.reduce((a, b) => a + b, 0) || 1
  return capWeights(exps.map((x) => x / t), M.nameCap)
}

function levelWeights(est: Estimate[]): number[] {
  const exps = est.map((e) => Math.exp((e.fit - 50) / 20))
  const t = exps.reduce((a, b) => a + b, 0) || 1
  return capWeights(exps.map((x) => x / t), ACTIVE_MODEL.nameCap)
}

// ── Types ────────────────────────────────────────────────────────────────────
export type Holding = Estimate & { weight: number } // weight within the WHOLE portfolio
export type Sleeve = { assetClass: Category; classWeight: number; holdings: Holding[] }
export type BondStats = { avgYtw: number; avgDuration: number; count: number }
export type Portfolio = {
  region: Region
  sleeves: Sleeve[]
  holdings: Holding[]
  expReturn: number
  vol: number
  sharpe: number
  riskLevel: RiskLevel
  bondStats: BondStats | null
  classDist: { assetClass: Category; count: number; weight: number }[]
  riskDist: Record<RiskLevel, number>
}
type MixSlice = { assetClass: Category; pct: number }

// Compute every metric from a set of (possibly hand-edited) weighted holdings.
// Weights are renormalized to 1; holdings are grouped into class sleeves. This is
// the single source of truth for portfolio math — the optimizer and the advisor's
// manual edits both flow through here.
export function assemblePortfolio(rawHoldings: Holding[], region: Region): Portfolio {
  const M = ACTIVE_MODEL
  const wSum = rawHoldings.reduce((a, h) => a + h.weight, 0) || 1
  const holdings = rawHoldings.map((h) => ({ ...h, weight: h.weight / wSum })).sort((a, b) => b.weight - a.weight)

  const byClass = new Map<Category, Holding[]>()
  for (const h of holdings) {
    const arr = byClass.get(h.inst.assetClass) ?? []
    arr.push(h)
    byClass.set(h.inst.assetClass, arr)
  }
  const sleeves: Sleeve[] = [...byClass.entries()]
    .map(([assetClass, hs]) => ({ assetClass, classWeight: Math.round(hs.reduce((a, h) => a + h.weight, 0) * 100), holdings: hs }))
    .sort((a, b) => b.classWeight - a.classWeight)

  const expReturn = holdings.reduce((a, h) => a + h.weight * h.expReturn, 0)

  let variance = 0
  for (const a of holdings)
    for (const b of holdings) {
      const rho = a === b ? 1 : a.inst.assetClass === b.inst.assetClass ? M.rhoWithin : M.rhoAcross
      variance += a.weight * b.weight * rho * a.vol * b.vol
    }
  const vol = Math.sqrt(Math.max(0, variance))
  const sharpe = vol > 0 ? (expReturn - M.rf) / vol : 0

  const bonds = holdings.filter((h) => h.inst.assetClass === 'Fixed income')
  let bondStats: BondStats | null = null
  if (bonds.length) {
    const bw = bonds.reduce((a, h) => a + h.weight, 0) || 1
    const avgYtw = bonds.reduce((a, h) => a + (h.weight / bw) * h.expReturn, 0)
    const durs = bonds.map((h) => ({ w: h.weight, d: bondDuration(h.inst) })).filter((x) => x.d != null)
    const dw = durs.reduce((a, x) => a + x.w, 0)
    const avgDuration = dw > 0 ? durs.reduce((a, x) => a + (x.w / dw) * (x.d as number), 0) : 0
    bondStats = { avgYtw, avgDuration, count: bonds.length }
  }

  const classDist = sleeves.map((s) => ({ assetClass: s.assetClass, count: s.holdings.length, weight: s.classWeight }))
  const riskDist: Record<RiskLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const h of holdings) riskDist[h.riskLevel]++

  return { region, sleeves, holdings, expReturn, vol, sharpe, riskLevel: riskBucket(vol), bondStats, classDist, riskDist }
}

// Pick + weight the instruments for one class (the suggested book).
function selectSleeve(
  assetClass: Category,
  classWeight: number,
  pool: ManagedInstrument[],
  scores: AxisScores,
  clientLevel: RiskLevel,
  assetsPerClass: number,
): Holding[] {
  const M = ACTIVE_MODEL
  const all = pool.map((i) => estimate(i, scores))
  const ceilinged = all.filter((e) => e.riskLevel <= clientLevel + M.levelCeiling)
  const est = (ceilinged.length ? ceilinged : all)
    .slice()
    .sort((a, b) => b.fit - a.fit)
    .slice(0, Math.max(1, assetsPerClass))
  if (est.length === 0) return []

  let internal: number[]
  if (assetClass === 'Equities') internal = mvoWeights(est.map((e) => e.expReturn), est.map((e) => e.vol))
  else if (assetClass === 'Fixed income' || assetClass === 'CDs') internal = bondWeights(est, clientLevel)
  else internal = levelWeights(est)

  return est
    .map((e, i) => ({ ...e, weight: (classWeight / 100) * internal[i] }))
    .filter((h) => h.weight > 0.0005)
}

export function buildPortfolio(
  region: Region,
  mix: MixSlice[],
  instruments: ManagedInstrument[],
  scores: AxisScores,
  level: RiskLevel,
  opts: { assetsPerClass?: number } = {},
): Portfolio {
  const assetsPerClass = opts.assetsPerClass ?? ACTIVE_MODEL.assetsPerClass
  const visible = instruments.filter((i) => (i.region ?? 'global') === region && i.visible)
  const holdings = mix
    .filter((m) => m.pct > 0)
    .flatMap((m) =>
      selectSleeve(m.assetClass, m.pct, visible.filter((i) => i.assetClass === m.assetClass), scores, level, assetsPerClass),
    )
  return assemblePortfolio(holdings, region)
}

// Build holdings from an explicit (advisor-edited) weight list.
export function holdingsFromWeights(
  weights: { instId: string; weight: number }[],
  instruments: ManagedInstrument[],
  scores: AxisScores,
): Holding[] {
  const byId = new Map(instruments.map((i) => [i.id, i]))
  const out: Holding[] = []
  for (const w of weights) {
    const inst = byId.get(w.instId)
    if (!inst || w.weight <= 0) continue
    out.push({ ...estimate(inst, scores), weight: w.weight })
  }
  return out
}

// ── Capital → holdings ───────────────────────────────────────────────────────
export type CapitalLine = { holding: Holding; units: number; cost: number; targetAmount: number; actualWeight: number }
export type CapitalPlan = { capital: number; lines: CapitalLine[]; invested: number; residual: number; unpriced: Holding[] }

export function allocateCapital(portfolio: Portfolio, capital: number): CapitalPlan {
  const priced = portfolio.holdings.filter((h) => h.unitPrice != null)
  const unpriced = portfolio.holdings.filter((h) => h.unitPrice == null)
  const wSum = priced.reduce((a, h) => a + h.weight, 0) || 1

  const lines: CapitalLine[] = priced.map((h) => {
    const price = h.unitPrice as number
    const targetAmount = capital * (h.weight / wSum)
    const units = Math.max(0, Math.floor(targetAmount / price))
    return { holding: h, units, cost: units * price, targetAmount, actualWeight: 0 }
  })

  let residual = capital - lines.reduce((a, l) => a + l.cost, 0)
  for (let guard = 0; guard < 100000; guard++) {
    let best = -1
    let bestShort = 0
    for (let i = 0; i < lines.length; i++) {
      const price = lines[i].holding.unitPrice as number
      if (price > residual + 1e-9) continue
      const short = lines[i].targetAmount - lines[i].cost
      if (short > bestShort) {
        bestShort = short
        best = i
      }
    }
    if (best === -1) break
    const price = lines[best].holding.unitPrice as number
    lines[best].units++
    lines[best].cost += price
    residual -= price
  }

  const invested = lines.reduce((a, l) => a + l.cost, 0)
  for (const l of lines) l.actualWeight = invested > 0 ? l.cost / invested : 0
  return { capital, lines, invested, residual: capital - invested, unpriced }
}
