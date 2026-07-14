import type { AllocRound } from '../types'
import type { Lang } from './i18n'
import { ARCHETYPES, type Archetype, type ArchetypeKey } from '../data/archetypes'
import type { AssetClass, Category, LocalCategory, Region } from '../lib/instruments'

// ---------------------------------------------------------------------------
// Content translations. English lives in the data files (the source of truth
// for scoring — ids, probabilities, and amounts never change per language);
// Spanish is layered on top at render time via the helpers below.
// ---------------------------------------------------------------------------

// ── Rounds: per-id display strings (side labels + scenario notes) ───────────
// Note: the round q/sub prompts are not rendered by the UI, so only labels and
// notes need translating. Notes are matched by scenario index.
type RoundSideEs = { label: string; notes: string[] }
const ROUNDS_ES: Record<number, { x: RoundSideEs; y: RoundSideEs }> = {
  1: {
    x: { label: 'Mayor potencial', notes: ['gran año', 'año sin cambios'] },
    y: { label: 'Ganancia más estable', notes: ['buen año', 'año sin cambios'] },
  },
  2: {
    x: { label: 'Gran premio infrecuente', notes: ['gran premio raro', 'la mayoría de los años'] },
    y: {
      label: 'Ganancia frecuente, gran pérdida rara',
      notes: ['la mayoría de los años', 'gran pérdida rara'],
    },
  },
  3: {
    x: { label: 'Apuesta 50/50', notes: ['ganas', 'pierdes'] },
    y: { label: 'Ganancia garantizada', notes: ['seguro'] },
  },
  4: {
    x: { label: 'Oscilación al alza', notes: ['ganancia', 'pérdida'] },
    y: { label: 'Oscilación a la baja', notes: ['ganancia', 'pérdida'] },
  },
  5: {
    x: { label: 'Premio gordo improbable', notes: ['premio 1 de 20', 'la mayoría de los años'] },
    y: { label: 'Predecible', notes: ['la mayoría de los años', 'mal año'] },
  },
  6: {
    x: { label: 'Mayor potencial', notes: ['gran año', 'año sin cambios'] },
    y: { label: 'Ganancia más estable', notes: ['buen año', 'año sin cambios'] },
  },
  7: {
    x: { label: 'Gran premio infrecuente', notes: ['gran premio raro', 'la mayoría de los años'] },
    y: {
      label: 'Ganancia frecuente, gran pérdida rara',
      notes: ['la mayoría de los años', 'gran pérdida rara'],
    },
  },
  8: {
    x: { label: 'Apuesta 50/50', notes: ['ganas', 'pierdes'] },
    y: { label: 'Ganancia garantizada', notes: ['seguro'] },
  },
  9: {
    x: { label: 'Oscilación al alza', notes: ['ganancia', 'pérdida'] },
    y: { label: 'Oscilación a la baja', notes: ['ganancia', 'pérdida'] },
  },
  10: {
    x: { label: 'Premio gordo improbable', notes: ['premio 1 de 20', 'la mayoría de los años'] },
    y: { label: 'Predecible', notes: ['la mayoría de los años', 'mal año'] },
  },
}

/** Round with display strings in the given language (scoring fields untouched). */
export function localizeRound(round: AllocRound, lang: Lang): AllocRound {
  if (lang !== 'es') return round
  const es = ROUNDS_ES[round.id]
  if (!es) return round
  return {
    ...round,
    x: {
      label: es.x.label,
      scenarios: round.x.scenarios.map((s, i) => ({ ...s, note: es.x.notes[i] ?? s.note })),
    },
    y: {
      label: es.y.label,
      scenarios: round.y.scenarios.map((s, i) => ({ ...s, note: es.y.notes[i] ?? s.note })),
    },
  }
}

// ── Archetypes ───────────────────────────────────────────────────────────────
const ARCHETYPES_ES: Record<ArchetypeKey, Archetype> = {
  banker: {
    name: 'El Banquero',
    desc: 'Proteges el capital ante todo — cedes rendimiento a cambio de certeza.',
    traits: ['Preserva capital', 'Prefiere certeza', 'Conservador', 'Caídas acotadas'],
    products: [
      'Autocallables con capital protegido',
      'Bonos investment grade de corta duración',
      'Escalera de bonos soberanos BVA',
      'ETFs multiactivo con cobertura a la baja',
    ],
  },
  quant: {
    name: 'El Cuantitativo',
    desc: 'Sigues el valor esperado — modelos sobre narrativa, matemática sobre intuición.',
    traits: ['Guiado por VE', 'Indiferente a la forma', 'Sistemático', 'Bajo sesgo conductual'],
    products: [
      'ETFs de factores de bajo costo',
      'Escaleras de bonos simples',
      'Notas soberanas BVA',
      'Estrategias de rebalanceo sistemático',
    ],
  },
  venture: {
    name: 'El Capitalista de Riesgo',
    desc: 'Apuestas fuerte por la chance de una ganancia extraordinaria.',
    traits: [
      'Orientado al alza',
      'Tolerante al riesgo',
      'Guiado por convicción',
      'Resiliente a pérdidas',
    ],
    products: [
      'Notas estructuradas con potencial ilimitado',
      'Acciones individuales selectivas',
      'Opciones de largo plazo sobre acciones',
      'Asignación satélite en cripto',
    ],
  },
  insurer: {
    name: 'El Asegurador',
    desc: 'Cobras una prima constante por asumir el riesgo que otros evitan.',
    traits: ['Cobra primas', 'Tolera asimetría negativa', 'Busca rendimiento', 'Suscribe riesgo'],
    products: [
      'Reverse convertibles autocallables',
      'ETFs con estrategia de covered calls',
      'Corporativos BVA de alto rendimiento',
      'Notas estructuradas con observación trimestral',
    ],
  },
  indexer: {
    name: 'El Indexador',
    desc: 'Prefieres ser dueño del mercado antes que intentar ganarle.',
    traits: ['Transparencia primero', 'Bajo costo', 'Mercado amplio', 'Baja complejidad'],
    products: [
      'Trackers MSCI World / S&P 500',
      'Bonos BVA investment grade simples',
      'ETF multiactivo diversificado',
      'Depósitos a plazo',
    ],
  },
}

/** Archetype copy in the given language. */
export function localizedArchetype(key: ArchetypeKey, lang: Lang): Archetype {
  return lang === 'es' ? ARCHETYPES_ES[key] : ARCHETYPES[key]
}

// ── Asset classes ────────────────────────────────────────────────────────────
// The AssetClass union members stay English — they're identifiers used as
// Record keys throughout the engine. Only the display label translates.
const ASSET_CLASS_ES: Record<AssetClass, string> = {
  'Fixed income': 'Renta fija',
  Equities: 'Acciones',
  'Income structures': 'Estructuras de renta',
  'Growth structures': 'Estructuras de crecimiento',
  Alternatives: 'Alternativos',
  Crypto: 'Cripto',
  'Cash/MMF': 'Efectivo/FMM',
}

export function assetClassLabel(cls: AssetClass, lang: Lang): string {
  return lang === 'es' ? ASSET_CLASS_ES[cls] : cls
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
  Equities: 'Acciones',
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
