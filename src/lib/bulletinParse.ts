import type { ManagedInstrument } from './catalog'
import type { LocalCategory } from './instruments'
import { deriveDefaults, deriveRiskVector } from './riskDerivation'
import type { ImportResult } from './importSchema'

// ---------------------------------------------------------------------------
// Cadiem boletín parser
// ---------------------------------------------------------------------------
// Reconstructs local instruments from the text lines of the Cadiem
// "Oportunidades de Inversión" boletín. Written against the real file, whose
// quirks drive every rule here:
//
//  • Currency lives on the SECTION header ("Renta Fija en Dólares"), while a
//    bare "Bonos" sub-header follows it — so a header only changes the currency
//    when it actually names one.
//  • Multi-series issuers use CONTINUATION rows that repeat neither issuer nor
//    rating ("9,90%  20.000.000  5,2  30/9/2031"). Those inherit the last
//    issuer/rating. Equities do the same but lead with a share class ("J - I").
//  • Long fund names WRAP onto the next line ("Fondo Mutuo Disponible en" /
//    "Guaraníes"), so a short alphabetic line inside a fund section is a name
//    continuation, not a row.
//
// σ/α/λ are derived from category + rating like every other import. It stays
// best-effort by nature, which is why the caller previews before adding.

const KIND: Record<LocalCategory, string> = {
  'Fixed income': 'Bono',
  CDs: 'CDA',
  'Mutual funds': 'Fondo mutuo',
  'Investment funds': 'Fondo de inversión',
  Equities: 'Acción Ordinaria',
}

const deaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => deaccent(s).toLowerCase()

// Credit-rating token, e.g. AAAPy, AA-py, A+py, BBB Py, AAfpy, Af-py, AAf- py.
const RATING = /[A-D]{1,3}\s?[+-]?\s?f?\s?[+-]?\s?[Pp]y/
const DATE = /\d{1,2}\/\d{1,2}\/\d{4}/g
const AMOUNT = /\d{1,3}(?:\.\d{3})+(?:,\d+)?/g // 1.960.000.000 or 5.000,00
const DECIMAL = /\d+,\d+/g // 10,85 or 2,8
const COUPON = /(mensual|bimestral|trimestral|semestral|anual|al vencimiento)/i
const PCT_RANGE = /\d+(?:[,.]\d+)?\s*%?\s*[-–]\s*\d+(?:[,.]\d+)?\s*%/ // "10% - 11%", "12-13%"
const PCT = /\d+(?:[,.]\d+)?\s*%/

type Currency = 'PYG' | 'USD'
type Section = { category: LocalCategory; label: string }

/** A section header carries no data. Currency is only set when it names one. */
function detectSection(line: string): { section: Section; currency?: Currency } | null {
  if (/\d/.test(line)) return null
  const n = norm(line)
  if (n.length > 60) return null
  const currency: Currency | undefined = /dolar/.test(n)
    ? 'USD'
    : /guarani/.test(n)
      ? 'PYG'
      : undefined
  const at = (category: LocalCategory, label: string) => ({ section: { category, label }, currency })
  if (/fondos? de inversion/.test(n)) return at('Investment funds', 'Fondos de inversión')
  if (/fondos? mutuos?/.test(n)) return at('Mutual funds', 'Fondos mutuos')
  if (/certificado de dep|\bcda\b/.test(n)) return at('CDs', 'CDA')
  if (/renta variable|\bacciones\b/.test(n)) return at('Equities', 'Renta variable')
  if (/renta fija|\bbonos?\b/.test(n)) return at('Fixed income', 'Bonos')
  return null
}

/** Does the line carry instrument data (vs. a column header or page furniture)? */
function looksLikeRow(line: string): boolean {
  return (
    RATING.test(line) ||
    /\d{1,2}\/\d{1,2}\/\d{4}/.test(line) ||
    /\d{1,3}(?:\.\d{3})+/.test(line) ||
    /\d+,\d+/.test(line) ||
    /\d+\s*%/.test(line)
  )
}

const curLabel = (c?: Currency) => (c === 'USD' ? 'USD ($)' : 'PYG (₲)')
const money = (c: Currency | undefined, v: string) => `${c === 'USD' ? '$' : '₲'} ${v}`

function put(details: Record<string, string>, key: string, val?: string) {
  if (val && val.trim()) details[key] = val.trim()
}

/** Yield as printed: a %-range, a single %, else a bare decimal. */
function readYield(text: string): string | undefined {
  const range = text.match(PCT_RANGE)
  if (range) return range[0].replace(/\s+/g, ' ')
  const pct = text.match(PCT)
  if (pct) return pct[0].replace(/\s+/g, '')
  const dec = text.match(DECIMAL)
  return dec ? `${dec[0]}%` : undefined
}

/** Strip amounts before scanning decimals, so "5.000,00" can't yield "000,00". */
function scanDecimals(rest: string, amounts: string[]): { raw: string; n: number }[] {
  let scan = rest
  for (const a of amounts) scan = scan.replace(a, ' ')
  return (scan.match(DECIMAL) || []).map((d) => ({
    raw: d,
    n: parseFloat(d.replace('.', '').replace(',', '.')),
  }))
}

type Row =
  | { kind: 'new'; lead: string; rating?: string; rest: string }
  | { kind: 'cont'; lead: string; rest: string }

/**
 * Split a data row into its leading identity and the rest.
 *  - a rating token ⇒ a new instrument, issuer = text before it
 *  - no rating, and (almost) nothing before the first figure ⇒ a continuation
 *    of the previous instrument (a further series / share class)
 *  - no rating but real leading text ⇒ a new instrument named by that text
 *    (funds print "-" instead of a rating)
 */
function splitRow(line: string): Row {
  const m = line.match(RATING)
  if (m && m.index != null) {
    return {
      kind: 'new',
      lead: line.slice(0, m.index).trim(),
      rating: m[0].replace(/\s+/g, ' ').trim(),
      rest: line.slice(m.index + m[0].length).trim(),
    }
  }
  const firstFig = line.search(/\d/)
  const lead = (firstFig > 0 ? line.slice(0, firstFig) : '').trim()
  // "", "-", "G -", "J - I", "D" ⇒ continuation; a real name ⇒ new row.
  if (lead.length <= 8) return { kind: 'cont', lead, rest: firstFig > 0 ? line.slice(firstFig) : line }
  return { kind: 'new', lead, rest: firstFig > 0 ? line.slice(firstFig) : '' }
}

/** A short alphabetic line inside a fund section = a wrapped name, not a row. */
function nameWrap(line: string): string | null {
  if (line.length > 30 || line.startsWith('*') || line.includes('.')) return null
  const lead = (line.search(/\d/) > 0 ? line.slice(0, line.search(/\d/)) : line).trim()
  if (!lead || !/^[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ '&-]*$/.test(lead)) return null
  return lead
}

/** Parse the whole boletín's text lines into local instruments. */
export function parseBulletin(lines: string[]): ImportResult {
  const instruments: ManagedInstrument[] = []
  const sectionsSeen: string[] = []
  const seen = new Set<string>()
  let section: Section | null = null
  let currency: Currency | undefined
  let issuer = ''
  let rating: string | undefined
  let last: ManagedInstrument | null = null // for name-wrap continuation
  let skipped = 0
  let seq = 0

  const push = (
    cat: LocalCategory,
    name: string,
    rtg: string | undefined,
    details: Record<string, string>,
    kind?: string,
  ) => {
    const vec = deriveRiskVector('local', cat, rtg ? { rating: rtg } : {})
    const def = deriveDefaults('local', cat)
    seq += 1
    let id = `blt-${cat.toLowerCase().replace(/[^a-z]+/g, '')}-${String(seq).padStart(2, '0')}`
    while (seen.has(id)) id += 'x'
    seen.add(id)
    const inst: ManagedInstrument = {
      id,
      name,
      ticker: '',
      region: 'local',
      assetClass: cat,
      kind: kind ?? KIND[cat],
      sigmaLoad: vec.sigmaLoad,
      alphaLoad: vec.alphaLoad,
      lambdaLoad: vec.lambdaLoad,
      liquidityTier: def.liquidityTier,
      lockupMonths: def.lockupMonths,
      visible: true,
      emphasized: false,
      details,
    }
    instruments.push(inst)
    return inst
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const head = detectSection(line)
    if (head) {
      section = head.section
      if (head.currency) currency = head.currency
      const label =
        head.section.category === 'Fixed income' || head.section.category === 'Equities'
          ? `${head.section.label} ${currency === 'USD' ? 'USD' : '₲'}`
          : head.section.label
      if (!sectionsSeen.includes(label)) sectionsSeen.push(label)
      issuer = ''
      rating = undefined
      last = null
      continue
    }
    if (!section) continue

    const isFund = section.category === 'Mutual funds' || section.category === 'Investment funds'

    if (!looksLikeRow(line)) {
      // Fund names wrap onto their own line — glue them back on.
      const prev = last
      const wrap = isFund && prev ? nameWrap(line) : null
      if (prev && wrap) prev.name = `${prev.name} ${wrap}`.replace(/\s+/g, ' ').trim()
      continue
    }

    // Funds print "<name> <yield> <rating|-> <terms…>", so the name is the text
    // before the first figure — not before the rating (the yield precedes it).
    if (isFund) {
      const firstFig = line.search(/\d/)
      const name = (firstFig > 0 ? line.slice(0, firstFig) : line).trim()
      const tail = firstFig > 0 ? line.slice(firstFig) : ''
      if (!name) {
        skipped++
        continue
      }
      const m = line.match(RATING)
      const rtg = m ? m[0].replace(/\s+/g, ' ').trim() : undefined
      const details: Record<string, string> = {}
      put(details, 'fundManager', 'Cadiem')
      put(details, 'rating', rtg)
      put(details, 'estYield', readYield(tail))
      put(details, 'currency', curLabel(currency))
      last = push(section.category, name, rtg, details)
      continue
    }

    const row = splitRow(line)
    if (row.kind === 'new') {
      if (row.rating) {
        issuer = row.lead || issuer
        rating = row.rating
      } else {
        issuer = row.lead
        rating = undefined
      }
    } else if (!issuer && !isFund) {
      // A continuation with nothing to inherit — not an instrument.
      skipped++
      continue
    }

    const rest = row.rest
    const details: Record<string, string> = {}
    const amounts = rest.match(AMOUNT) || []
    const decimals = scanDecimals(rest, amounts)

    if (section.category === 'Equities') {
      put(details, 'issuer', issuer)
      put(details, 'rating', rating)
      // Share class: on a continuation row it IS the lead ("G", "J - I"); on a
      // rated row the lead is the issuer, so the class is the text before the
      // first figure of the rest ("I - 70.000.000…" → "I", "- 11,50%…" → none).
      // Ordinary vs preferred, read from the "Observaciones" column. It's a
      // MERGED (rowspan) cell, so "Acciones Preferidas" only prints on the first
      // row of a block and continuation rows come out blank; some preferred rows
      // are also labelled only "Acciones Electrónicas…" (no "preferid"). BVA
      // listed shares here are preferred, so we invert the default: PREFERRED
      // unless the row explicitly says "ordinaria"/"común".
      const ordinary = /ordinaria|com[uú]n/i.test(rest)
      const kind = ordinary ? 'Acción Ordinaria' : 'Acción Preferida'
      const clsRaw = row.kind === 'cont' ? row.lead : (rest.match(/^[^\d]*/)?.[0] ?? '')
      let cls = clsRaw.replace(/^[-–\s]+/, '').replace(/[-–\s]+$/, '').trim()
      // A real share class is a short series token ("G", "J - I") — not the
      // share-type descriptor the PDF prints in this column ("Acciones
      // Electrónicas…"), which the greedy old code let leak into the name.
      if (cls.length > 8 || /acci[oó]n|electr[oó]nic|trimestr|vto/i.test(cls)) cls = ''
      if (cls) put(details, 'shareClass', cls)
      put(details, 'shareType', ordinary ? 'Ordinaria' : 'Preferida')
      // Columns: Disponibilidad · Precio · Valor de venta — price is the middle.
      if (amounts.length >= 2) put(details, 'price', money(currency, amounts[1]))
      if (amounts[0]) put(details, 'available', money(currency, amounts[0]))
      if (amounts[2]) put(details, 'saleValue', money(currency, amounts[2]))
      const y = decimals.find((d) => d.n < 100)
      if (y) put(details, 'estYield', `${y.raw}%`)
      put(details, 'currency', curLabel(currency))
      const label = details.shareClass ? `${issuer} — ${details.shareClass}` : issuer
      const name = details.price ? `${label} (${details.price})` : label
      last = push('Equities', name, rating, details, kind)
      continue
    }

    // Debt: Fixed income + CDs.
    put(details, 'issuer', issuer)
    put(details, 'rating', rating)
    const dates = rest.match(DATE)
    if (dates?.length) put(details, 'maturity', dates[dates.length - 1])
    const coupon = rest.match(COUPON)
    if (coupon) put(details, 'couponFrequency', coupon[1][0].toUpperCase() + coupon[1].slice(1).toLowerCase())
    if (amounts.length) {
      const biggest = amounts.slice().sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)[0]
      if (biggest) put(details, 'available', money(currency, biggest))
    }
    const yld = decimals.find((d) => d.n < 100)
    if (yld) put(details, 'estYield', `${yld.raw}%`)
    const residual = decimals.filter((d) => d !== yld).find((d) => d.n < 40)
    if (residual) put(details, 'residualYears', residual.raw)
    put(details, 'currency', curLabel(currency))
    last = push(section.category, issuer, rating, details)
  }

  return { instruments, skipped, matched: sectionsSeen, unmatched: [] }
}
