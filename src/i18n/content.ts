import type { Lang } from './i18n'
import {
  ARCHETYPES,
  ARCHETYPE_COLORS,
  SEED_ARCHETYPE_IDS,
  type Archetype,
  type ArchetypeKey,
} from '../data/archetypes'
import type { AssetClass, Category, LocalCategory, Region } from '../lib/instruments'

// ---------------------------------------------------------------------------
// Content translations. English lives in the data files (the source of truth
// for scoring — ids and amounts never change per language); Spanish is layered
// on top at render time via the helpers below.
// ---------------------------------------------------------------------------

// ── Archetypes ───────────────────────────────────────────────────────────────
// Seed Spanish copy — the fallback before the admin config loads, and the source
// the config provider seeds each archetype's `es` fields from. Voseo (Paraguay).
export const ARCHETYPES_ES: Record<ArchetypeKey, Archetype> = {
  guardian: {
    name: 'El Guardián',
    desc: 'Protegés el capital ante todo y lo mantenés a mano — certeza y acceso por encima del potencial de alza.',
    traits: ['Preserva capital', 'Valora la liquidez', 'Caídas acotadas', 'Conservador'],
    products: [
      'Bonos investment grade de corta duración',
      'Escalera de letras del Tesoro',
      'Depósitos a plazo (CDA)',
      'Fondos money market y líquidos',
    ],
  },
  income: {
    name: 'El Rentista',
    desc: 'Buscás renta estable y estás dispuesto a inmovilizar capital para obtenerla, mientras el riesgo se mantenga moderado.',
    traits: ['Busca rendimiento', 'Acepta plazos', 'Riesgo moderado', 'Enfocado en renta'],
    products: [
      'Bonos corporativos investment grade',
      'Escalera de bonos soberanos',
      'Notas estructuradas con cupón',
      'Fondos de inversión plurianuales',
    ],
  },
  balanced: {
    name: 'El Equilibrado',
    desc: 'Buscás el punto medio — una mezcla diversificada que equilibra crecimiento con estabilidad y acceso.',
    traits: ['Diversificado', 'Riesgo equilibrado', 'Flexible', 'Punto medio'],
    products: [
      'ETFs multiactivo diversificados',
      'Una mezcla de bonos y acciones',
      'Fondos indexados de mercado amplio',
      'Fondos mutuos balanceados',
    ],
  },
  opportunist: {
    name: 'El Oportunista',
    desc: 'Asumís riesgo pero te mantenés líquido — posiciones ágiles que podés cerrar para aprovechar la próxima oportunidad.',
    traits: ['Tolerante al riesgo', 'Valora la liquidez', 'Táctico', 'Oportunista'],
    products: [
      'ETFs de renta variable líquidos',
      'Acciones individuales',
      'ETFs sectoriales y temáticos',
      'Notas de participación negociables',
    ],
  },
  builder: {
    name: 'El Constructor',
    desc: 'Apostás al crecimiento de largo plazo y podés inmovilizar capital por años para capitalizarlo.',
    traits: ['Orientado al crecimiento', 'Horizonte largo', 'Resiliente a pérdidas', 'Alta convicción'],
    products: [
      'Acciones de crecimiento y temáticas',
      'Notas de participación sin tope',
      'Fondos privados y de riesgo',
      'Posiciones de renta variable de largo plazo',
    ],
  },
}

// The five risk bands are ADMIN-DEFINED presets (Bands page). The config
// provider pushes the live, bilingual set in here so every call site resolves a
// band's name/desc/color by LEVEL (1…5) without threading config through the
// tree. Traits/products still come from the seed archetype copy (client result).
type Bi = { en: string; es: string }
export type ActiveBand = {
  level: number
  color: string
  name: Bi
  desc: Bi
}
let ACTIVE_BANDS: ActiveBand[] = []
export function setActiveBands(list: ActiveBand[]): void {
  ACTIVE_BANDS = list
}

/** The seed archetype backing a band level, for fallback copy (name/desc/traits/products). */
function seedForLevel(level: number): Archetype {
  const id = (SEED_ARCHETYPE_IDS[level - 1] ?? SEED_ARCHETYPE_IDS[0]) as ArchetypeKey
  return ARCHETYPES[id] ?? { name: `Nivel ${level}`, desc: '', traits: [], products: [] }
}
function seedForLevelEs(level: number): Archetype {
  const id = (SEED_ARCHETYPE_IDS[level - 1] ?? SEED_ARCHETYPE_IDS[0]) as ArchetypeKey
  return ARCHETYPES_ES[id] ?? seedForLevel(level)
}

/** Full band copy (name/desc/traits/products) in the given language. */
export function localizedBand(level: number, lang: Lang): Archetype {
  const b = ACTIVE_BANDS.find((x) => x.level === level)
  const seed = lang === 'es' ? seedForLevelEs(level) : seedForLevel(level)
  if (b) return { name: b.name[lang], desc: b.desc[lang], traits: seed.traits, products: seed.products }
  return seed
}

/** Accent color for a band — admin-set, else the bundled seed color. */
export function bandColor(level: number): string {
  const b = ACTIVE_BANDS.find((x) => x.level === level)
  if (b) return b.color
  const id = SEED_ARCHETYPE_IDS[level - 1]
  return (id && ARCHETYPE_COLORS[id]) || '#8A8D99'
}

// ── Asset classes ────────────────────────────────────────────────────────────
// The AssetClass union members stay English — they're identifiers used as
// Record keys throughout the engine. Only the display label translates.
const ASSET_CLASS_ES: Record<AssetClass, string> = {
  'Fixed income': 'Renta fija',
  Equities: 'Renta variable',
  'Structured notes': 'Notas estructuradas',
}

export function assetClassLabel(cls: AssetClass, lang: Lang): string {
  // Fall back to the identifier: data saved under a since-retired class would
  // otherwise render as literally nothing in Spanish while English still shows
  // the raw name — a defect invisible to an English-speaking reviewer.
  return (lang === 'es' ? ASSET_CLASS_ES[cls] : cls) || cls
}

// Local (Cadiem) categories — English identifiers, Spanish display labels.
const LOCAL_CATEGORY_EN: Record<LocalCategory, string> = {
  'Fixed income': 'Fixed income',
  Equities: 'Equities',
  CDs: 'CDs',
  'Mutual funds': 'Mutual funds',
  'Investment funds': 'Investment funds',
}
const LOCAL_CATEGORY_ES: Record<LocalCategory, string> = {
  'Fixed income': 'Renta fija',
  Equities: 'Renta variable',
  CDs: 'CDA',
  'Mutual funds': 'Fondos mutuos',
  'Investment funds': 'Fondos de inversión',
}

/** Localized label for any category, using the region's taxonomy. */
export function categoryLabel(category: Category, region: Region, lang: Lang): string {
  if (region === 'local') {
    const c = category as LocalCategory
    return lang === 'es' ? LOCAL_CATEGORY_ES[c] : LOCAL_CATEGORY_EN[c]
  }
  return assetClassLabel(category as AssetClass, lang)
}

const REGION_LABELS: Record<Region, { en: string; es: string }> = {
  global: { en: 'Global', es: 'Global' },
  local: { en: 'Local', es: 'Local' },
}
export function regionLabel(region: Region, lang: Lang): string {
  return lang === 'es' ? REGION_LABELS[region].es : REGION_LABELS[region].en
}
