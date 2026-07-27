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

// Correlation is NOT one number per class pair. Every instrument is decomposed
// into exposures to four common risk factors — global equity, rates, credit and
// the local (Guaraní) market — plus an idiosyncratic remainder. Two instruments
// correlate because they load on the same factors, so an A-rated 3-year bond and
// a 20-year Treasury are correctly *less* correlated than two 20-year bonds, and
// a high-beta name correlates more with the market than a defensive one. The
// loadings come from data the catalog already holds (β, duration, credit rating,
// sector, issuer, region). See `pairCorrelation` below.
export type FactorRho = {
  mktRates: number // global equity ↔ rates
  mktCredit: number // global equity ↔ credit spread
  mktLocal: number // global equity ↔ local market
  ratesCredit: number // rates ↔ credit spread
  ratesLocal: number // rates ↔ local market
  creditLocal: number // credit spread ↔ local market
}

export type CorrelationModel = {
  marketVol: number // σ of the global-equity factor (also the β→vol bridge)
  rateVol: number // σ per year of duration (the rates factor)
  factorRho: FactorRho
  sameSector: number // extra correlation between two equities in the same sector
  sameIssuer: number // extra correlation between two instruments from one issuer
  noteEquityShare: number // share of a structured note's vol driven by equity
  fundEquityShare: number // same, for funds/ETFs with no β of their own
  localShare: number // share of a local instrument's vol on the local factor
}

export type PortfolioModel = {
  rf: number // risk-free rate
  erp: number // equity risk premium (CAPM)
  analystBlend: number // weight on the analyst-target leg vs the CAPM leg (0..1)
  nameCap: number // max weight of a single name within its sleeve
  totalAssets: number // how many instruments the suggested book holds in total
  levelCeiling: number // exclude instruments more than this many levels above the client's band
  bandDuration: Record<RiskLevel, number> // target bond duration (years) per band
  correlation: CorrelationModel
}

export const DEFAULT_PORTFOLIO_MODEL: PortfolioModel = {
  rf: 0.04,
  erp: 0.05,
  analystBlend: 0.5,
  nameCap: 0.35,
  totalAssets: 14,
  levelCeiling: 1,
  bandDuration: { 1: 2, 2: 3.5, 3: 5, 4: 6.5, 5: 8 },
  correlation: {
    marketVol: 0.16,
    rateVol: 0.009,
    factorRho: {
      mktRates: -0.15,
      mktCredit: 0.45,
      mktLocal: 0.15,
      ratesCredit: -0.1,
      ratesLocal: 0.05,
      creditLocal: 0.3,
    },
    sameSector: 0.3,
    sameIssuer: 0.85,
    noteEquityShare: 0.55,
    fundEquityShare: 0.7,
    localShare: 0.7,
  },
}

let ACTIVE_MODEL: PortfolioModel = DEFAULT_PORTFOLIO_MODEL
export const setActivePortfolioModel = (m: PortfolioModel): void => {
  ACTIVE_MODEL = m
  FACTOR_CACHE = new WeakMap()
}
export const getPortfolioModel = (): PortfolioModel => ACTIVE_MODEL

const marketVolParam = () => ACTIVE_MODEL.correlation.marketVol
const rateVolParam = () => ACTIVE_MODEL.correlation.rateVol

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
/**
 * Read a number out of a display-formatted string ("+37.1%", "₲500.000", "1,234.56").
 *
 * `thousands` controls the one genuinely ambiguous case: "2.950". For a Guaraní
 * price that is 2,950; for a coupon it is 2.95%. Format alone can't tell them
 * apart, so the CALLER decides — money keeps the European-thousands reading,
 * rates and durations turn it off (see parseRate).
 */
export function parseNum(v: string | undefined, thousands = true): number | null {
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
  } else if (thousands && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '') // 500.000 / 1.050 → European thousands
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/** For rates, yields, durations and ratios — never thousands-separated. */
export const parseRate = (v: string | undefined): number | null => parseNum(v, false)

function pct(v: string | undefined): number | null {
  const n = parseRate(v)
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
  return parseRate(inst.details.duration) ?? parseRate(inst.details.residualYears)
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
    if (beta && beta > 0) return beta * marketVolParam()
    return undefined
  }
  if (cls === 'Fixed income') {
    const dur = bondDuration(inst)
    if (dur && dur > 0) return dur * rateVolParam() + ratingVol(d.creditRating ?? d.rating)
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

// ── Correlation: a four-factor decomposition ─────────────────────────────────
// Instead of "same class → 0.7, different class → 0.2", each instrument's
// volatility is split across four common factors and an idiosyncratic residual:
//
//   mkt    global equity      β × σ_market for a listed equity; a share of vol
//                             for notes and funds (they are equity-linked but we
//                             don't know the underlying's β).
//   rates  duration exposure  years of modified duration × σ_rates.
//   credit spread exposure    the rating's vol component.
//   local  Guaraní market     local-region instruments sit here, not on the
//                             global factors — Paraguayan rates are their own.
//
// Two instruments then correlate through the factors they share, and only
// through those. Residual (single-name) risk is uncorrelated EXCEPT between two
// equities in the same sector, or two instruments from the same issuer.
//
// Because the covariance is built as LΦLᵀ + diagonal + non-negative block terms,
// it is positive semi-definite by construction (Φ is force-fed through a
// Sylvester check below), which is what keeps the mean-variance solve stable.

const FACTORS = ['mkt', 'rates', 'credit', 'local'] as const
type Factor = (typeof FACTORS)[number]
type Loads = Record<Factor, number>
type Decomp = { loads: Loads; idio: number; sector: string; issuer: string; equity: boolean }

const zeroLoads = (): Loads => ({ mkt: 0, rates: 0, credit: 0, local: 0 })

// Factor correlation matrix Φ, shrunk toward the identity until it is positive
// definite — an admin can type any six numbers, and an indefinite Φ would let
// the optimizer chase a "risk-free" combination that doesn't exist.
function phiMatrix(): number[][] {
  const r = ACTIVE_MODEL.correlation.factorRho
  const c = (x: number) => Math.max(-0.95, Math.min(0.95, Number.isFinite(x) ? x : 0))
  let off = [c(r.mktRates), c(r.mktCredit), c(r.mktLocal), c(r.ratesCredit), c(r.ratesLocal), c(r.creditLocal)]
  for (let attempt = 0; attempt < 24; attempt++) {
    const [mr, mc, ml, rc, rl, cl] = off
    const m = [
      [1, mr, mc, ml],
      [mr, 1, rc, rl],
      [mc, rc, 1, cl],
      [ml, rl, cl, 1],
    ]
    if (isPositiveDefinite(m)) return m
    off = off.map((x) => x * 0.85) // shrink toward the identity and retry
  }
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]
}

// Sylvester's criterion: every leading principal minor must be positive.
function isPositiveDefinite(m: number[][]): boolean {
  for (let k = 1; k <= m.length; k++) {
    if (determinant(m.slice(0, k).map((row) => row.slice(0, k))) <= 1e-9) return false
  }
  return true
}

function determinant(m: number[][]): number {
  const n = m.length
  const a = m.map((r) => r.slice())
  let det = 1
  for (let i = 0; i < n; i++) {
    let piv = i
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[piv][i])) piv = r
    if (Math.abs(a[piv][i]) < 1e-12) return 0
    if (piv !== i) {
      ;[a[i], a[piv]] = [a[piv], a[i]]
      det = -det
    }
    det *= a[i][i]
    for (let r = i + 1; r < n; r++) {
      const f = a[r][i] / a[i][i]
      for (let cIdx = i; cIdx < n; cIdx++) a[r][cIdx] -= f * a[i][cIdx]
    }
  }
  return det
}

// The quadratic form Lᵀ Φ L' — the covariance explained by the common factors.
function factorCov(a: Loads, b: Loads, phi: number[][]): number {
  let s = 0
  for (let i = 0; i < FACTORS.length; i++) {
    for (let j = 0; j < FACTORS.length; j++) s += a[FACTORS[i]] * b[FACTORS[j]] * phi[i][j]
  }
  return s
}

const normKey = (s: string | undefined): string =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')

// Cached per instrument object — the decomposition only changes when the model
// changes, and setActivePortfolioModel clears the cache.
let FACTOR_CACHE = new WeakMap<ManagedInstrument, Decomp>()

function decompose(inst: ManagedInstrument, vol: number): Decomp {
  const cached = FACTOR_CACHE.get(inst)
  if (cached) return cached

  const C = ACTIVE_MODEL.correlation
  const d = inst.details
  const cls = inst.assetClass
  const region = inst.region ?? 'global'
  const loads = zeroLoads()

  if (region === 'local') {
    // The local market is its own factor: Guaraní rates, local credit, local
    // liquidity. Global β and US duration say nothing about it.
    loads.local = C.localShare * vol
  } else if (cls === 'Equities') {
    const beta = parseNum(d.beta)
    loads.mkt = Math.min(vol, (beta && beta > 0 ? beta : 1) * C.marketVol)
  } else if (cls === 'Fixed income') {
    const dur = bondDuration(inst)
    loads.rates = Math.min(vol, (dur && dur > 0 ? dur : 0) * C.rateVol)
    loads.credit = Math.min(Math.max(0, vol - loads.rates), ratingVol(d.creditRating ?? d.rating))
  } else if (cls === 'Structured notes') {
    loads.mkt = C.noteEquityShare * vol // equity-linked payoff, unknown underlying β
  } else if (cls === 'CDs') {
    loads.rates = 0.5 * vol
  } else {
    loads.mkt = C.fundEquityShare * vol // mutual / investment funds
  }

  // Force the decomposition to reproduce the instrument's own volatility, so
  // cov(i,i) === vol² exactly and the correlation matrix has a unit diagonal.
  const phi = phiMatrix()
  let explained = factorCov(loads, loads, phi)
  if (explained > vol * vol) {
    const k = vol / Math.sqrt(explained)
    for (const f of FACTORS) loads[f] *= k
    explained = vol * vol
  }
  const idio = Math.sqrt(Math.max(0, vol * vol - explained))

  const out: Decomp = {
    loads,
    idio,
    sector: normKey(d.sectorIndex || d.sector),
    issuer: normKey(d.issuer) || normKey(inst.ticker),
    equity: cls === 'Equities',
  }
  FACTOR_CACHE.set(inst, out)
  return out
}

/** Covariance between two estimated instruments, from the factor model. */
export function pairCovariance(a: Estimate, b: Estimate): number {
  if (a.inst.id === b.inst.id) return a.vol * a.vol
  const C = ACTIVE_MODEL.correlation
  const da = decompose(a.inst, a.vol)
  const db = decompose(b.inst, b.vol)
  let cov = factorCov(da.loads, db.loads, phiMatrix())
  // Residual co-movement: same issuer first (a company's bond and its stock),
  // then same sector for two equities.
  let residual = 0
  if (da.issuer && da.issuer === db.issuer) residual = C.sameIssuer
  else if (da.equity && db.equity && da.sector && da.sector === db.sector) residual = C.sameSector
  if (residual > 0) cov += Math.max(0, Math.min(1, residual)) * da.idio * db.idio
  // A correlation above 1 is not meaningful; clamp on the covariance scale.
  const cap = a.vol * b.vol
  return Math.max(-cap, Math.min(cap, cov))
}

/** The implied pairwise correlation — used by the UI and the tutorial. */
export function pairCorrelation(a: Estimate, b: Estimate): number {
  const denom = a.vol * b.vol
  return denom > 0 ? pairCovariance(a, b) / denom : 0
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

// Solve A x = b by Gaussian elimination with partial pivoting. Returns null if
// the system is singular (the caller falls back to inverse-volatility weights).
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const m = A.map((row, i) => [...row, b[i]])
  for (let i = 0; i < n; i++) {
    let piv = i
    for (let r = i + 1; r < n; r++) if (Math.abs(m[r][i]) > Math.abs(m[piv][i])) piv = r
    if (Math.abs(m[piv][i]) < 1e-12) return null
    ;[m[i], m[piv]] = [m[piv], m[i]]
    for (let r = 0; r < n; r++) {
      if (r === i) continue
      const f = m[r][i] / m[i][i]
      for (let c = i; c <= n; c++) m[r][c] -= f * m[i][c]
    }
  }
  const x = m.map((row, i) => row[n] / row[i])
  return x.every((v) => Number.isFinite(v)) ? x : null
}

// Max-Sharpe (tangency) weights: w ∝ Σ⁻¹(μ − rf), long-only, per-name capped.
// Σ is the FULL factor covariance matrix, so two names that genuinely move
// together get penalized against each other instead of every pair sharing one
// blanket correlation. A small ridge keeps a near-singular Σ solvable.
function mvoWeights(est: Estimate[]): number[] {
  const M = ACTIVE_MODEL
  const n = est.length
  if (n === 1) return [1]

  const cov: number[][] = est.map((a) => est.map((b) => pairCovariance(a, b)))
  const ridge = (cov.reduce((s, row, i) => s + row[i], 0) / n) * 1e-4
  for (let i = 0; i < n; i++) cov[i][i] += ridge

  const excess = est.map((e) => e.expReturn - M.rf)
  const raw = solve(cov, excess)
  const invVol = () => capWeights(est.map((e) => 1 / Math.max(e.vol, 1e-6)), M.nameCap)
  if (!raw) return invVol()
  const long = raw.map((x) => Math.max(0, x))
  if (long.every((x) => x <= 1e-12)) return invVol()
  return capWeights(long, M.nameCap)
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
  for (const a of holdings) for (const b of holdings) variance += a.weight * b.weight * pairCovariance(a, b)
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
  count: number,
): Holding[] {
  const M = ACTIVE_MODEL
  const all = pool.map((i) => estimate(i, scores))
  const ceilinged = all.filter((e) => e.riskLevel <= clientLevel + M.levelCeiling)
  const est = (ceilinged.length ? ceilinged : all)
    .slice()
    .sort((a, b) => b.fit - a.fit)
    .slice(0, Math.max(1, count))
  if (est.length === 0) return []

  let internal: number[]
  if (assetClass === 'Equities') internal = mvoWeights(est)
  else if (assetClass === 'Fixed income' || assetClass === 'CDs') internal = bondWeights(est, clientLevel)
  else internal = levelWeights(est)

  return est
    .map((e, i) => ({ ...e, weight: (classWeight / 100) * internal[i] }))
    .filter((h) => h.weight > 0.0005)
}

/**
 * Split a TOTAL number of names across the classes the band allocates to.
 *
 * The advisor sets one number — how big the book should be — not a count per
 * class, so the split has to follow the money: a band that puts 76% in bonds
 * should hold more bonds than equities. Largest-remainder apportionment does
 * that exactly, and every class in the mix keeps a floor of one name so a small
 * sleeve is never silently dropped (which is why the realized total can exceed
 * the request when the band spreads across more classes than names asked for —
 * `minimumAssets` reports that floor so the UI can show it).
 */
export function apportionAssets(mix: MixSlice[], total: number): Map<Category, number> {
  const active = mix.filter((m) => m.pct > 0)
  const out = new Map<Category, number>()
  if (active.length === 0) return out

  const extra = Math.max(total, active.length) - active.length
  const pctSum = active.reduce((a, m) => a + m.pct, 0) || 1
  const shares = active.map((m) => ({ cls: m.assetClass, exact: (m.pct / pctSum) * extra }))
  for (const s of shares) out.set(s.cls, 1 + Math.floor(s.exact))

  let left = extra - shares.reduce((a, s) => a + Math.floor(s.exact), 0)
  for (const s of [...shares].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (left <= 0) break
    out.set(s.cls, (out.get(s.cls) ?? 1) + 1)
    left--
  }
  return out
}

/** The smallest book a band can produce — one name per class it allocates to. */
export const minimumAssets = (mix: MixSlice[]): number => mix.filter((m) => m.pct > 0).length

export function buildPortfolio(
  region: Region,
  mix: MixSlice[],
  instruments: ManagedInstrument[],
  scores: AxisScores,
  level: RiskLevel,
  opts: { totalAssets?: number } = {},
): Portfolio {
  const perClass = apportionAssets(mix, opts.totalAssets ?? ACTIVE_MODEL.totalAssets)
  const visible = instruments.filter((i) => (i.region ?? 'global') === region && i.visible)
  const holdings = mix
    .filter((m) => m.pct > 0)
    .flatMap((m) =>
      selectSleeve(
        m.assetClass,
        m.pct,
        visible.filter((i) => i.assetClass === m.assetClass),
        scores,
        level,
        perClass.get(m.assetClass) ?? 1,
      ),
    )
  return assemblePortfolio(holdings, region)
}

/**
 * Re-run the optimizer over EXACTLY the instruments the advisor has kept, so the
 * book adds back up to 100%. Unlike buildPortfolio this never adds or drops a
 * name and never applies the risk-level ceiling — the advisor picked these on
 * purpose. What it does re-derive is the weights: the band's asset-class split
 * is applied to the classes actually present (renormalized), and inside each
 * class the same optimizer runs as for the suggested book. A class the advisor
 * added that the band gives 0% keeps an equal-weight share rather than
 * silently vanishing.
 */
export function reoptimize(
  instIds: string[],
  region: Region,
  mix: MixSlice[],
  instruments: ManagedInstrument[],
  scores: AxisScores,
  level: RiskLevel,
): Holding[] {
  const byId = new Map(instruments.map((i) => [i.id, i]))
  const picked = instIds.map((id) => byId.get(id)).filter((i): i is ManagedInstrument => !!i)
  if (picked.length === 0) return []

  const byClass = new Map<Category, ManagedInstrument[]>()
  for (const inst of picked) {
    const arr = byClass.get(inst.assetClass) ?? []
    arr.push(inst)
    byClass.set(inst.assetClass, arr)
  }

  const mixPct = new Map(mix.map((m) => [m.assetClass, m.pct]))
  const targets = [...byClass.entries()].map(([assetClass, members]) => ({
    assetClass,
    members,
    // The band's share, or an equal-weight fallback for a class the band ignores.
    pct: mixPct.get(assetClass) || (members.length / picked.length) * 100,
  }))
  const totalPct = targets.reduce((a, t) => a + t.pct, 0) || 1

  return targets.flatMap((t) => {
    const est = t.members.map((i) => estimate(i, scores))
    let internal: number[]
    if (t.assetClass === 'Equities') internal = mvoWeights(est)
    else if (t.assetClass === 'Fixed income' || t.assetClass === 'CDs') internal = bondWeights(est, level)
    else internal = levelWeights(est)
    const classWeight = t.pct / totalPct
    return est.map((e, i) => ({ ...e, weight: classWeight * internal[i] }))
  })
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
