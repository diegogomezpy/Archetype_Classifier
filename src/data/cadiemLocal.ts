import type { ManagedInstrument } from '../lib/catalog'
import type { LocalCategory } from '../lib/instruments'

// ---------------------------------------------------------------------------
// Cadiem local (Paraguayan) instrument menu
// ---------------------------------------------------------------------------
// Transcribed from the Cadiem "Oportunidades de Inversión" bulletin
// (Boletín 07-07, 7 Jul 2026): local bonds (₲ & USD), a CDA, mutual and
// investment funds, and local equities (preferred / electronic shares).
//
// Every entry is region 'local'. Risk vectors (σ/α/λ) are DERIVED from the
// instrument's category and credit rating (see the helpers below) so the
// existing fit engine can rank them — the admin can retune any of them. The
// bulletin's published fields (issuer, rating, yield, coupon frequency,
// maturity, residual term, amount, currency) go into `details`.
// Yields/ratings are referential and subject to confirmation (per the bulletin).

const AS_OF = '2026-07-07'

// Credit rating → risk factor r ∈ [0,1] (0 = safest, 1 = riskiest).
const RATING_RISK: Record<string, number> = {
  AAApy: 0.0, AAAPy: 0.0,
  'AA+py': 0.12, 'AA+Py': 0.12, AApy: 0.15, AAf: 0.12, 'AAf-py': 0.12, AAfpy: 0.12,
  'AA-py': 0.2,
  'A+py': 0.32, Apy: 0.38, 'Af-py': 0.3, 'A-py': 0.42, 'A Py': 0.38,
  'BBB+py': 0.58, BBBpy: 0.62, BBBPy: 0.62, 'BBB Py': 0.62, 'BBB-py': 0.68, 'BBB-Py': 0.68,
  'BB+py': 0.82, 'BB+Py': 0.82,
}
const riskOf = (rating: string): number => RATING_RISK[rating.trim()] ?? 0.5
const round2 = (n: number) => Math.round(n * 100) / 100

type Vec = { sigmaLoad: number; alphaLoad: number; lambdaLoad: number }

// Per-category risk-vector derivation from the credit-risk factor r.
function bondVector(rating: string): Vec {
  const r = riskOf(rating)
  return {
    sigmaLoad: round2(-0.35 + 0.6 * r), // riskier credit ⇒ more variance
    alphaLoad: round2(-0.35 - 0.25 * r), // negative skew (rare default tail)
    lambdaLoad: round2(0.45 - 0.85 * r), // safe = loss-averse, junk = loss-tolerant
  }
}
function cdVector(rating: string): Vec {
  const r = riskOf(rating)
  return { sigmaLoad: round2(-0.75 + 0.3 * r), alphaLoad: 0, lambdaLoad: round2(0.7 - 0.4 * r) }
}
function fundVector(rating: string, aggressive: boolean): Vec {
  const r = riskOf(rating)
  const base = aggressive ? -0.35 : -0.6
  return {
    sigmaLoad: round2(base + 0.35 * r),
    alphaLoad: 0,
    lambdaLoad: round2((aggressive ? 0.4 : 0.6) - 0.4 * r),
  }
}
// Investment funds: illiquid, longer horizon, moderate convexity.
const investmentFundVector: Vec = { sigmaLoad: 0.1, alphaLoad: 0.2, lambdaLoad: 0.15 }
// Local equities (preferred / electronic shares): equity-like with an income tilt.
const localEquityVector: Vec = { sigmaLoad: 0.4, alphaLoad: 0.0, lambdaLoad: -0.2 }

// Amount formatting helpers (Paraguayan thousands separator is '.').
const pyg = (s: string) => `₲ ${s}`
const usd = (s: string) => `$ ${s}`

let idSeq = 0
function make(
  category: LocalCategory,
  vec: Vec,
  name: string,
  ticker: string,
  liquidityTier: 1 | 2 | 3 | 4,
  lockupMonths: number,
  details: Record<string, string>,
): ManagedInstrument {
  idSeq += 1
  const id = `cadiem-${category.toLowerCase().replace(/[^a-z]+/g, '')}-${String(idSeq).padStart(2, '0')}`
  // Drop empty detail values so the sheet stays clean.
  const clean: Record<string, string> = { asOf: AS_OF }
  for (const [k, v] of Object.entries(details)) if (v && v.trim() !== '') clean[k] = v.trim()
  return {
    id,
    name,
    ticker,
    region: 'local',
    assetClass: category,
    source: 'menu',
    ...vec,
    liquidityTier,
    lockupMonths,
    visible: true,
    emphasized: false,
    details: clean,
  }
}

// ── Bonds (Renta Fija) ──────────────────────────────────────────────────────
// Row tuple: [issuer, rating, yield%, coupon, amount, residualYears, maturity]
type BondRow = [string, string, string, string, string, string, string]

function bonds(rows: BondRow[], currency: 'PYG' | 'USD'): ManagedInstrument[] {
  const fmt = currency === 'PYG' ? pyg : usd
  const curLabel = currency === 'PYG' ? 'PYG (₲)' : 'USD ($)'
  return rows.map(([issuer, rating, yld, coupon, amount, residual, maturity]) =>
    make('Fixed income', bondVector(rating), issuer, 'BONO', 2, 0, {
      issuer,
      rating,
      estYield: `${yld}%`,
      couponFrequency: coupon,
      maturity,
      residualYears: residual,
      available: fmt(amount),
      currency: curLabel,
    }),
  )
}

const BONDS_PYG: BondRow[] = [
  ['Telecel', 'AAAPy', '10,85', 'Mensual', '15.000.000', '2,8', '30/4/2029'],
  ['Telecel', 'AAAPy', '10,00', 'Mensual', '40.000.000', '4,2', '30/9/2030'],
  ['Telecel', 'AAAPy', '9,90', 'Mensual', '286.000.000', '4,2', '30/9/2030'],
  ['Telecel', 'AAAPy', '9,90', 'Mensual', '80.000.000', '5,2', '30/9/2031'],
  ['Nucleo SA', 'AAAPy', '9,15', 'Semestral', '705.000.000', '1,6', '2/2/2028'],
  ['Banco Continental', 'AAAPy', '9,65', 'Semestral', '3.407.000.000', '4,9', '26/5/2031'],
  ['Kurosu & CIA', 'AApy', '8,99', 'Semestral', '15.000.000', '1,4', '14/12/2027'],
  ['Banco Basa', 'AA-py', '9,90', 'Trimestral', '1.000.000', '1,8', '28/4/2028'],
  ['CECON', 'AA-py', '10,00', 'Trimestral', '500.000.000', '3,7', '18/3/2030'],
  ['CECON', 'AA-py', '8,50', '', '305.000.000', '', '15/8/2031'],
  ['CECON', 'AA-py', '8,50', '', '20.000.000', '', '16/1/2031'],
  ['Exxel Technologies', 'A+py', '9,75', 'Trimestral', '288.000.000', '1,8', '12/5/2028'],
  ['S.A.C.I Petersen', 'Apy', '10,50', 'Trimestral', '30.000.000', '3,2', '10/9/2029'],
  ['FPJ', 'Apy', '8,00', 'Semestral', '145.000.000', '1,9', '16/5/2028'],
  ['Imperial SAE', 'Apy', '9,13', 'Trimestral', '22.000.000', '2,5', '19/12/2028'],
  ['IBI S.A.E.C.A', 'Apy', '10,00', 'Trimestral', '500.000.000', '2,3', '20/10/2028'],
  ['IBI S.A.E.C.A', 'Apy', '10,25', 'Trimestral', '1.960.000.000', '4,0', '19/7/2030'],
  ['IBI S.A.E.C.A', 'Apy', '10,75', 'Trimestral', '700.000.000', '5,8', '4/5/2032'],
  ['Gas Corona', 'A-py', '9,65', 'Trimestral', '20.000.000', '2,3', '10/11/2028'],
  ['Tu Financiera', 'A-py', '10,38', 'Trimestral', '127.000.000', '5,7', '2/3/2032'],
  ['Tu Financiera', 'A-py', '10,15', 'Trimestral', '107.000.000', '5,7', '2/3/2032'],
  ['Grupo Vazquez', 'A-py', '8,00', 'Trimestral', '520.000.000', '8,6', '9/2/2035'],
  ['Grupo Vazquez', 'A-py', '11,50', 'Trimestral', '57.000.000', '7,9', '6/6/2034'],
  ['Grupo Vazquez', 'A-py', '10,75', 'Trimestral', '435.000.000', '3,7', '5/4/2030'],
  ['Enersur', 'A-py', '9,50', 'Trimestral', '90.000.000', '1,3', '7/10/2027'],
  ['INDEX SACI', 'A-py', '10,00', 'Trimestral', '31.000.000', '1,2', '22/9/2027'],
  ['INDEX SACI', 'A-py', '10,20', 'Trimestral', '10.000.000', '1,8', '4/5/2028'],
  ['Electroban', 'BBBPy', '14,15', 'Trimestral', '6.000.000', '0,0', '7/7/2026'],
  ['Jet Trade', 'BBB-Py', '12,50', 'Trimestral', '3.000.000', '2,4', '14/12/2028'],
  ['Biotec', 'BBB-Py', '12,00', 'Trimestral', '33.000.000', '1,6', '17/2/2028'],
  ['Biotec', 'BBB-Py', '12,00', 'Trimestral', '160.000.000', '1,8', '25/4/2028'],
  ['Import Center', 'BB+Py', '13,25', 'Trimestral', '90.000.000', '2,6', '29/1/2029'],
  ['Import Center', 'BB+Py', '13,35', 'Trimestral', '20.000.000', '2,9', '30/5/2029'],
  ['Import Center', 'BB+Py', '13,35', 'Trimestral', '113.000.000', '3,9', '30/5/2030'],
  ['Frigorífico Concepción', 'BB+py', '19,15', 'Trimestral', '140.000.000', '1,2', '31/8/2027'],
  ['Frigorífico Concepción', 'BB+py', '24,75', 'Trimestral', '20.000.000', '1,4', '23/11/2027'],
  ['Frigorífico Concepción', 'BB+py', '18,65', 'Trimestral', '192.000.000', '1,4', '23/11/2027'],
  ['Frigorífico Concepción', 'BB+py', '15,75', 'Trimestral', '100.000.000', '1,8', '6/4/2028'],
  ['Frigorífico Concepción', 'BB+py', '14,83', 'Trimestral', '50.000.000', '2,6', '28/1/2029'],
  ['Frigorífico Concepción', 'BB+py', '12,50', 'Trimestral', '40.000.000', '3,5', '8/1/2030'],
]

const BONDS_USD: BondRow[] = [
  ['Sudameris Bank', 'AAApy', '4,50', 'Trimestral', '5.000,00', '5,2', '3/9/2031'],
  ['Sudameris Bank', 'AAApy', '6,75', 'Trimestral', '6.000,00', '3,4', '6/12/2029'],
  ['Ueno Bank', 'Aapy', '9,00', 'Trimestral', '3.000,00', '0,6', '26/1/2027'],
  ['Solar Banco', 'Apy', '5,50', 'Trimestral', '4.000,00', '4,6', '3/2/2031'],
  ['ITTI', 'Apy', '7,50', 'Trimestral', '700.000,00', '4,4', '5/12/2030'],
  ['ALPACASA', 'BBB+py', '8,59', 'Trimestral', '1.000,00', '6,9', '16/6/2033'],
  ['ALPACASA', 'BBB+py', '8,20', 'Trimestral', '1.000,00', '6,3', '15/10/2032'],
  ['ALPACASA', 'BBB+py', '6,40', 'Trimestral', '5.000,00', '0,8', '15/4/2027'],
  ['Frigorífico Concepción', 'BB+py', '9,29', 'Trimestral', '36.000,00', '3,0', '28/6/2029'],
  ['Frigorífico Concepción', 'BB+py', '13,50', 'Trimestral', '10.000,00', '0,7', '16/3/2027'],
]

// ── CDA (certificates of deposit) ───────────────────────────────────────────
const CDS: ManagedInstrument[] = [
  make('CDs', cdVector('AA-py'), 'Zeta Banco', 'CDA', 3, 0, {
    issuer: 'Zeta Banco',
    rating: 'AA-py',
    estYield: '10,00%',
    couponFrequency: 'Trimestral',
    maturity: '3/4/2029',
    residualYears: '2,7',
    cuts: '1 x 60.000.000',
    currency: 'PYG (₲)',
  }),
]

// ── Mutual funds (Fondos Mutuos) ────────────────────────────────────────────
// Row: [name, rating, return%, horizon, incomePayment, redemption, min, currency, aggressive]
const MUTUAL: ManagedInstrument[] = [
  make('Mutual funds', fundVector('AAfpy', false), 'Fondo Mutuo Disponible en Guaraníes', 'FM', 1, 0, {
    fundManager: 'Cadiem', rating: 'AAfpy', estYield: '6,83%', horizon: 'Corto plazo',
    dividendPayment: 'Diario', redemption: '1 día hábil', minInvestment: '₲ 1.000.000', currency: 'PYG (₲)',
  }),
  make('Mutual funds', fundVector('Af-py', true), 'Fondo Mutuo Proyección en Guaraníes', 'FM', 1, 0, {
    fundManager: 'Cadiem', estYield: '9,23%', horizon: 'Mediano plazo',
    dividendPayment: 'Diario', redemption: '5 días hábiles', minInvestment: 'Sin límite', currency: 'PYG (₲)',
  }),
  make('Mutual funds', fundVector('Af-py', true), 'Fondo Mutuo Crecimiento', 'FM', 1, 0, {
    fundManager: 'Cadiem', rating: 'Af-py', estYield: '8,68%', horizon: 'Mediano - largo plazo',
    dividendPayment: 'Diario', redemption: '5 días hábiles', minInvestment: '₲ 10.000.000', currency: 'PYG (₲)',
  }),
  make('Mutual funds', fundVector('Af-py', true), 'Fondo Mutuo Para Todos', 'FM', 1, 0, {
    fundManager: 'Cadiem', estYield: '8,36%', horizon: 'Mediano - largo plazo',
    dividendPayment: 'Diario', redemption: '2 días hábiles', minInvestment: '₲ 300.000', currency: 'PYG (₲)',
  }),
  make('Mutual funds', fundVector('AAf-py', false), 'Fondo Mutuo Disponible en Dólares Americanos', 'FM', 1, 0, {
    fundManager: 'Cadiem', rating: 'AAf-py', estYield: '4,34%', horizon: 'Corto plazo',
    dividendPayment: 'Diario', redemption: '1 día hábil', minInvestment: 'USD 250', currency: 'USD ($)',
  }),
  make('Mutual funds', fundVector('AAf-py', true), 'Fondo Mutuo Proyección en Dólares', 'FM', 1, 0, {
    fundManager: 'Cadiem', estYield: '5,58%', horizon: 'Mediano plazo',
    dividendPayment: 'Diario', redemption: '5 días hábiles', minInvestment: 'Sin límite', currency: 'USD ($)',
  }),
]

// ── Investment funds (Fondos de Inversión) ──────────────────────────────────
const INVESTMENT: ManagedInstrument[] = [
  make('Investment funds', investmentFundVector, 'Fondo de Inversión Las Orquídeas', 'FI', 4, 12, {
    fundManager: 'Cadiem', estYield: '10% - 11%', dividendPayment: 'Al vencimiento',
    shareValue: '₲ 1.000.000', saleValue: '₲ 150.000.000', term: '1 año', minInvestment: '150 cuotas', currency: 'PYG (₲)',
  }),
  make('Investment funds', investmentFundVector, 'Fondo de Inversión Link Center', 'FI', 4, 180, {
    fundManager: 'Cadiem', estYield: '12% - 13%', dividendPayment: 'Anual después del 5º año',
    shareValue: '$ 1.000', saleValue: '$ 1.000', term: '15 años', minInvestment: '$ 250.000', currency: 'USD ($)',
  }),
]

// ── Local equities (Renta Variable / Acciones) ──────────────────────────────
// Row: [issuer, rating, class, yield, price, amount, sale, shareType]
type EqRow = [string, string, string, string, string, string, string, string]
const EQ_ROWS: EqRow[] = [
  ['Sudameris Bank', 'AA+Py', '-', '11,50', '1.050', '252.228.000', '264.839.400', 'Acciones preferidas'],
  ['Electroban', 'BBB Py', 'G', '', '450.000', '100.000.000', '90.000.000', 'Acciones preferidas'],
  ['Electroban', 'BBB Py', '-', '', '400.000', '100.000.000', '80.000.000', 'Acciones preferidas'],
  ['Electroban', 'BBB Py', '-', '', '500.000', '540.000.000', '540.000.000', 'Acciones preferidas'],
  ['Electroban', 'BBB Py', 'I', '', '450.000', '50.000.000', '45.000.000', 'Acciones preferidas'],
  ['Electroban', 'BBB Py', 'J - I', '14,50', '500.000', '7.511.000.000', '7.511.000.000', 'Acciones electrónicas (vtos. trimestrales)'],
  ['Electroban', 'BBB Py', '-', '14,50', '500.000', '49.000.000', '245.000.000', 'Acción preferida electrónica'],
  ['Electroban', 'BBB Py', 'J', '14,50', '375.000', '55.000.000', '41.250.000', 'Acción preferida electrónica'],
  ['IBI SAECA', 'A Py', 'D', '13,50', '1.000.000', '10.000.000', '10.000.000', 'Acción preferida electrónica'],
]
const EQUITIES: ManagedInstrument[] = EQ_ROWS.map(([issuer, rating, cls, yld, price, amount, sale, type]) => {
  // Name drops the yield (shown in the row's quick facts); price keeps the
  // several preferred-share classes distinguishable.
  const label = cls && cls !== '-' ? `${issuer} — Clase ${cls}` : issuer
  const name = `${label} (₲ ${price})`
  return make('Equities', localEquityVector, name, 'ACC', 3, 0, {
    issuer,
    rating,
    shareClass: cls && cls !== '-' ? cls : '',
    shareType: type,
    estYield: yld ? `${yld}%` : '',
    price: pyg(price),
    available: pyg(amount),
    saleValue: pyg(sale),
    currency: 'PYG (₲)',
  })
})

export const CADIEM_LOCAL: ManagedInstrument[] = [
  ...bonds(BONDS_PYG, 'PYG'),
  ...bonds(BONDS_USD, 'USD'),
  ...CDS,
  ...MUTUAL,
  ...INVESTMENT,
  ...EQUITIES,
]
