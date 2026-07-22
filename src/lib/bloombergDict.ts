// ---------------------------------------------------------------------------
// Bloomberg display-value cleanup
// ---------------------------------------------------------------------------
// Bloomberg terminal exports (e.g. Gletir's "Listado de Bonos") clip every
// column at a fixed display width and bake a trailing "…" into the text, and
// they print country as a 2-letter Bloomberg code (its own scheme, not ISO —
// CH=China, GE=Germany, JN=Japan…). This module expands both on import so a raw
// paste self-cleans instead of loading truncated, cryptic values. Issuer names
// can't be recovered from a dictionary, so we only strip the trailing "…".

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const hasEllipsis = (s: string) => /…\s*$|\.\.\.\s*$/.test(s)

/** Drop a trailing "…"/"..." (Bloomberg's width-clip marker). */
export const stripEllipsis = (s: string): string => s.replace(/\s*(?:…|\.\.\.)\s*$/, '').trim()

// Full Bloomberg industry names. A clipped sector is matched by prefix against
// this list; already-full or unknown values pass through unchanged.
const FULL_SECTORS = [
  'Auto Manufacturers',
  'Auto Parts & Equipment',
  'Building Materials',
  'Commercial Services',
  'Diversified Finan Serv',
  'Forest Products & Paper',
  'Healthcare-Services',
  'Home Furnishings',
  'Investment Companies',
  'Machinery-Constr & Mining',
  'Packaging & Containers',
  'Telecommunications',
  'Transportation',
  'Semiconductors',
  'Pharmaceuticals',
  'Agriculture',
  'Airlines',
  'Pipelines',
  'Computers',
  'Internet',
  'Software',
  'Electric',
  'Banks',
  'Retail',
  'Mining',
  'Media',
  'Lodging',
  'Food',
]

// Non-truncated but ugly spellings worth tidying. Keys are already normalized
// (lowercased, alphanumeric-only) to match the `norm(s)` lookup below.
const SECTOR_EXACT: Record<string, string> = {
  oilgas: 'Oil & Gas',
  reits: 'REITs',
}

/** Expand a clipped/abbreviated Bloomberg industry name to its full form. */
export function expandSector(raw?: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  const exact = SECTOR_EXACT[norm(s)]
  if (exact) return exact
  if (!hasEllipsis(s)) return s
  const prefix = norm(stripEllipsis(s))
  // A bare clip marker ("…"/"...") strips to nothing — don't let an empty prefix
  // match the first sector; leave it as-is.
  if (!prefix) return stripEllipsis(s)
  const hit = FULL_SECTORS.find((f) => norm(f).startsWith(prefix))
  return hit ?? stripEllipsis(s)
}

// Bloomberg 2-letter country-of-risk codes → English country names. Verified
// against the actual Gletir issuers (Bloomberg's scheme differs from ISO).
export const COUNTRY_CODES: Record<string, string> = {
  US: 'United States',
  FR: 'France',
  GE: 'Germany',
  LX: 'Luxembourg',
  AS: 'Austria',
  CA: 'Canada',
  JN: 'Japan',
  MULT: 'Multinational',
  PN: 'Panama',
  QA: 'Qatar',
  MX: 'Mexico',
  SK: 'South Korea',
  CI: 'Cayman Islands',
  HK: 'Hong Kong',
  CL: 'Chile',
  SR: 'Saudi Arabia',
  MA: 'Malaysia',
  UA: 'United Arab Emirates',
  VS: 'Taiwan',
  NE: 'Netherlands',
  CO: 'Colombia',
  AR: 'Argentina',
  BZ: 'Brazil',
  PE: 'Peru',
  UR: 'Uruguay',
  PG: 'Paraguay',
  CH: 'China',
  EN: 'United Kingdom',
}

/** Expand a Bloomberg country code to a name; pass through anything already spelled out. */
export function expandCountry(raw?: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  return COUNTRY_CODES[s.toUpperCase()] ?? s
}
