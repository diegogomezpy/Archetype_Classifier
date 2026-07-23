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
    x: { label: 'Gran ganancia infrecuente', notes: ['gran ganancia rara', 'la mayoría de los años'] },
    y: {
      label: 'Ganancia frecuente, gran pérdida rara',
      notes: ['la mayoría de los años', 'gran pérdida rara'],
    },
  },
  3: {
    x: { label: 'Apuesta 50/50', notes: ['ganás', 'perdés'] },
    y: { label: 'Ganancia garantizada', notes: ['seguro'] },
  },
  4: {
    x: { label: 'Oscilación con sesgo alcista', notes: ['ganancia', 'pérdida'] },
    y: { label: 'Oscilación con sesgo bajista', notes: ['ganancia', 'pérdida'] },
  },
  5: {
    x: { label: 'Premio gordo improbable', notes: ['premio 1 de cada 20', 'la mayoría de los años'] },
    y: { label: 'Predecible', notes: ['la mayoría de los años', 'mal año'] },
  },
  6: {
    x: { label: 'Mayor potencial', notes: ['gran año', 'año sin cambios'] },
    y: { label: 'Ganancia más estable', notes: ['buen año', 'año sin cambios'] },
  },
  7: {
    x: { label: 'Gran ganancia infrecuente', notes: ['gran ganancia rara', 'la mayoría de los años'] },
    y: {
      label: 'Ganancia frecuente, gran pérdida rara',
      notes: ['la mayoría de los años', 'gran pérdida rara'],
    },
  },
  8: {
    x: { label: 'Apuesta 50/50', notes: ['ganás', 'perdés'] },
    y: { label: 'Ganancia garantizada', notes: ['seguro'] },
  },
  9: {
    x: { label: 'Oscilación con sesgo alcista', notes: ['ganancia', 'pérdida'] },
    y: { label: 'Oscilación con sesgo bajista', notes: ['ganancia', 'pérdida'] },
  },
  10: {
    x: { label: 'Premio gordo improbable', notes: ['premio 1 de cada 20', 'la mayoría de los años'] },
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
    desc: 'Protegés el capital ante todo — cedés potencial de alza a cambio de certeza.',
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
    desc: 'Seguís el valor esperado — modelos antes que narrativa, matemática antes que intuición.',
    traits: ['Guiado por valor esperado', 'Indiferente a la forma del pago', 'Sistemático', 'Bajo sesgo conductual'],
    products: [
      'ETFs de factores de bajo costo',
      'Escaleras de bonos simples',
      'Notas soberanas BVA',
      'Estrategias de rebalanceo sistemático',
    ],
  },
  venture: {
    name: 'El Capitalista de Riesgo',
    desc: 'Apostás fuerte por la chance de una ganancia extraordinaria.',
    traits: [
      'Orientado al alza',
      'Tolerante al riesgo',
      'Guiado por convicción',
      'Resiliente a pérdidas',
    ],
    products: [
      'Notas estructuradas sin tope de ganancia',
      'Selección de acciones individuales',
      'Opciones de largo plazo sobre acciones',
      'Asignación satélite en notas de participación',
    ],
  },
  insurer: {
    name: 'El Asegurador',
    desc: 'Cobrás una prima constante por asumir el riesgo que otros evitan.',
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
    desc: 'Preferís ser dueño del mercado antes que intentar ganarle.',
    traits: ['Transparencia primero', 'Bajo costo', 'Mercado amplio', 'Baja complejidad'],
    products: [
      'ETFs MSCI World / S&P 500',
      'Bonos simples BVA investment grade',
      'ETF multiactivo diversificado',
      'Depósitos a plazo',
    ],
  },
}

// Admin-editable display names, layered over the bundled copy. The config
// provider pushes these in (mirroring setActiveShapeVectors) so every call site
// picks an override up without threading config through the whole tree.
export type ArchetypeNameOverrides = Partial<Record<ArchetypeKey, { en?: string; es?: string }>>
let NAME_OVERRIDES: ArchetypeNameOverrides = {}
export function setArchetypeNameOverrides(o: ArchetypeNameOverrides | undefined): void {
  NAME_OVERRIDES = o ?? {}
}

/** Archetype copy in the given language, with any admin rename applied. */
export function localizedArchetype(key: ArchetypeKey, lang: Lang): Archetype {
  const base = lang === 'es' ? ARCHETYPES_ES[key] : ARCHETYPES[key]
  const custom = (lang === 'es' ? NAME_OVERRIDES[key]?.es : NAME_OVERRIDES[key]?.en)?.trim()
  return custom ? { ...base, name: custom } : base
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
