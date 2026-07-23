import { useEffect, useMemo, useState } from 'react'
import {
  categoriesForRegion,
  colorForCategory,
  isLocalCategory,
  type AssetClass,
  type Category,
  type Region,
} from '../lib/instruments'
import {
  fetchableFields,
  fieldSpecsFor,
  kindLabel,
  localQuickFacts,
  subclassesFor,
  subclassFor,
  supportsFetch,
  useCatalog,
  type FieldSpec,
  type ManagedInstrument,
} from '../lib/catalog'
import { fetchInstrumentData } from '../lib/marketData'
import { useLang, useT } from '../i18n/i18n'
import { categoryLabel, regionLabel } from '../i18n/content'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'
import CompanyLogos from '../components/CompanyLogos'
import ImportInstruments from '../components/ImportInstruments'
import InstrumentDocs from '../components/InstrumentDocs'

const REGIONS: Region[] = ['global', 'local']

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function newInstrument(): ManagedInstrument {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `inst_${Date.now().toString(36)}`,
    name: '',
    ticker: '',
    region: 'global',
    assetClass: 'Equities',
    sigmaLoad: 0,
    alphaLoad: 0,
    lambdaLoad: 0,
    liquidityTier: 1,
    lockupMonths: 0,
    visible: true,
    emphasized: false,
    details: {},
  }
}

const inputCls =
  'w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text shadow-soft outline-none transition-shadow placeholder:text-muted/60 focus:ring-2 focus:ring-teal/40'
const labelCls = 'mb-1.5 block text-xs font-medium text-muted'

// Filter-panel styling shared by the Market / Visibility / Category controls.
const filterGroupLabel = 'font-mono text-[10px] uppercase tracking-wider text-muted'
const segmentedCls = 'inline-flex rounded-full border border-border bg-surface p-0.5'
const segBtn = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium transition-all ${
    active ? 'bg-teal/15 text-teal shadow-soft' : 'text-muted hover:text-text'
  }`
const chipCls = (active: boolean) =>
  `flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all ${
    active
      ? 'border-transparent bg-teal/15 font-medium text-teal shadow-soft'
      : 'border-border bg-surface text-muted hover:text-text'
  }`
const subLabel = 'font-mono text-[11px] uppercase tracking-[0.14em] text-faint'

const pick = (lang: 'en' | 'es', en: string, es: string) => (lang === 'es' ? es : en)

// Detail fields are bucketed into labelled sub-sections so the edit form reads
// as groups instead of one 20-field wall. A field lands in the first group whose
// key list contains it; anything unmatched falls through to "Other". `kind` and
// `name` are intentionally omitted — they're edited up top on the instrument
// itself, not as details.
const DETAIL_GROUPS: { en: string; es: string; keys: string[] }[] = [
  { en: 'Rationale', es: 'Tesis', keys: ['rationale', 'diversificationNote', 'volatilityNote'] },
  { en: 'Overview', es: 'Resumen', keys: ['description'] },
  {
    en: 'Analyst consensus',
    es: 'Consenso de analistas',
    keys: ['priceTarget', 'potentialReturn', 'recBuyPct', 'recHoldPct', 'recSellPct', 'analystCount'],
  },
  {
    en: 'Classification',
    es: 'Clasificación',
    keys: [
      'issuer', 'sector', 'sectorIndex', 'country', 'exchange', 'underlying', 'exposure', 'currency',
    ],
  },
  {
    en: 'Terms',
    es: 'Condiciones',
    keys: [
      'couponRate', 'couponFrequency', 'couponYield', 'maturity', 'maturityMonths', 'duration',
      'ytm', 'creditRating', 'issuerRating', 'minInvestment', 'nextCall', 'referenceRate', 'spread',
      'impliedInflation', 'barrier', 'autocallLevel',
      'observationFrequency', 'capitalProtection', 'participationRate', 'cap', 'protectionLevel',
      'expenseRatio', 'distributionYield', 'worstCase',
    ],
  },
  {
    en: 'Pricing',
    es: 'Precios',
    keys: ['bid', 'ask', 'ytmBid', 'ytmAsk', 'ytc'],
  },
  {
    en: 'Market data',
    es: 'Datos de mercado',
    keys: [
      'lastPrice', 'range52w', 'change1Y', 'avgVolume', 'marketCapAum', 'dividendYield',
      'peRatio', 'peForward', 'beta', 'impliedVol3m',
    ],
  },
  { en: 'Source', es: 'Fuente', keys: ['asOf'] },
]

/** Bucket a class's field specs into the ordered groups above (empty groups dropped). */
function groupedSpecs(specs: FieldSpec[]): { en: string; es: string; specs: FieldSpec[] }[] {
  const fields = specs.filter((s) => s.key !== 'kind' && s.key !== 'name')
  const claimed = new Set<string>()
  const groups = DETAIL_GROUPS.map((g) => {
    const inGroup = fields.filter((s) => g.keys.includes(s.key))
    inGroup.forEach((s) => claimed.add(s.key))
    return { en: g.en, es: g.es, specs: inGroup }
  })
  const leftover = fields.filter((s) => !claimed.has(s.key))
  if (leftover.length) groups.push({ en: 'Other', es: 'Otros', specs: leftover })
  return groups.filter((g) => g.specs.length > 0)
}
const LONG_FIELDS = new Set([
  'rationale', 'description', 'worstCase', 'diversificationNote', 'volatilityNote',
])

// ── Edit / create form ───────────────────────────────────────────────────────

function InstrumentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ManagedInstrument
  onSave: (item: ManagedInstrument) => void
  onCancel: () => void
}) {
  const t = useT()
  const { lang } = useLang()
  const [draft, setDraft] = useState<ManagedInstrument>({ ...initial, details: { ...initial.details } })
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState<string | null>(null)

  const region: Region = draft.region ?? 'global'

  const set = <K extends keyof ManagedInstrument>(key: K, value: ManagedInstrument[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  // Switching region moves the instrument into the other taxonomy — reset the
  // category to that region's first one so it's always valid.
  const setRegion = (r: Region) =>
    setDraft((d) => ({ ...d, region: r, assetClass: categoriesForRegion(r)[0], kind: undefined }))

  // Autofill the detail sheet from live market data (ticker/ISIN). The backend
  // fetches from Yahoo Finance (equities) or CoinGecko + Deribit (crypto).
  const autofill = async () => {
    setFetching(true)
    setFetchMsg(null)
    const sym = draft.ticker.trim() || (draft.isin ?? '').trim()
    const res = await fetchInstrumentData({
      ticker: draft.ticker.trim(),
      isin: (draft.isin ?? '').trim(),
      assetClass: draft.assetClass as AssetClass,
    })
    setFetching(false)
    if (res.ok) {
      // name + kind belong on the instrument, not in the detail sheet.
      const { name: fName, kind: fKind, ...detailFields } = res.fields
      // Keep only the fields this subclass actually surfaces (server returns the
      // whole class set) — else a fetched Preferred / ETF / Crypto-ETP would
      // stash hidden fields that leak into the report.
      const resolvedKind = draft.kind?.trim() || fKind
      const allowed = fetchableFields(draft.assetClass, region, resolvedKind)
      const rest: Record<string, string> = {}
      for (const [k, v] of Object.entries(detailFields)) if (allowed.has(k)) rest[k] = v
      const n = Object.keys(rest).length
      setDraft((d) => ({
        ...d,
        name: d.name.trim() || fName || d.name,
        kind: d.kind?.trim() || fKind || d.kind,
        details: { ...d.details, ...rest },
      }))
      setFetchMsg(n > 0 ? t.admin.autofillFilled(n) : t.admin.autofillNotFound(sym))
    } else {
      setFetchMsg(
        res.reason === 'unsupported'
          ? t.admin.autofillUnsupported
          : res.reason === 'network'
            ? t.admin.autofillNetwork
            : t.admin.autofillNotFound(sym),
      )
    }
  }
  const setDetail = (key: string, value: string) =>
    setDraft((d) => ({ ...d, details: { ...d.details, [key]: value } }))
  const num = (v: string, fallback = 0) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
  }

  // Fields, fetchability, and the Type dropdown are all narrowed to the chosen
  // subclass — pick "Floating-rate note" and the reference-rate/spread fields
  // appear; pick "Fixed-rate bond" and they don't.
  const specs = fieldSpecsFor(region, draft.assetClass, draft.kind)
  const fetchSet = fetchableFields(draft.assetClass, region, draft.kind)
  const subclasses = subclassesFor(region, draft.assetClass)

  const save = () => {
    if (!draft.name.trim()) return
    onSave({
      ...draft,
      name: draft.name.trim(),
      ticker: draft.ticker.trim(),
      kind: draft.kind?.trim() || undefined,
      isin: draft.isin?.trim() || undefined,
      sigmaLoad: clamp(draft.sigmaLoad, -1, 1),
      alphaLoad: clamp(draft.alphaLoad, -1, 1),
      lambdaLoad: clamp(draft.lambdaLoad, -1, 1),
      lockupMonths: Math.max(0, Math.round(draft.lockupMonths)),
    })
  }

  return (
    <div className="rounded-2xl border border-teal/30 bg-surface p-6 shadow-card">
      {/* Identity */}
      <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
        {pick(lang, 'Identity', 'Identidad')}
      </h3>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>{t.admin.name}</label>
          <input
            className={inputCls}
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>{t.admin.kind}</label>
          <select className={inputCls} value={draft.kind ?? ''} onChange={(e) => set('kind', e.target.value)}>
            <option value="">—</option>
            {/* Preserve a legacy/off-list value so editing never silently drops it. */}
            {draft.kind && !subclasses.some((s) => s.id === draft.kind) && (
              <option value={draft.kind}>{kindLabel(draft.kind, lang, region, draft.assetClass)}</option>
            )}
            {subclasses.map((s) => (
              <option key={s.id} value={s.id}>
                {pick(lang, s.en, s.es)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.admin.ticker}</label>
          <input
            className={inputCls}
            value={draft.ticker}
            onChange={(e) => set('ticker', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>{t.admin.isin}</label>
          <input
            className={inputCls}
            value={draft.isin ?? ''}
            placeholder={t.admin.isinPlaceholder}
            onChange={(e) => set('isin', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>{t.admin.region}</label>
          <select
            className={inputCls}
            value={region}
            onChange={(e) => setRegion(e.target.value as Region)}
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {regionLabel(r, lang)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.admin.assetClass}</label>
          <select
            className={inputCls}
            value={draft.assetClass}
            onChange={(e) => setDraft((d) => ({ ...d, assetClass: e.target.value as Category, kind: undefined }))}
          >
            {categoriesForRegion(region).map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c, region, lang)}
              </option>
            ))}
          </select>
        </div>
        {/* Autofill from a market-data source — only for fetchable subclasses. */}
        {supportsFetch(draft.assetClass, region, draft.kind) && (
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={autofill}
              disabled={fetching || (!draft.ticker.trim() && !(draft.isin ?? '').trim())}
              className="shrink-0 rounded-xl border border-teal/40 bg-teal/10 px-4 py-2 text-sm font-medium text-teal transition-all duration-200 hover:bg-teal/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {fetching ? t.admin.autofillFetching : t.admin.autofill}
            </button>
            <span className="text-xs leading-snug text-muted">{fetchMsg ?? t.admin.autofillHint}</span>
          </div>
        )}
      </div>

      {/* Risk vector — what the client's profile is matched against */}
      <h3 className="mt-8 font-mono text-xs uppercase tracking-[0.14em] text-muted">
        {pick(lang, 'Risk vector', 'Vector de riesgo')}
      </h3>
      <p className="mt-1 text-xs leading-snug text-muted">
        {pick(
          lang,
          'σ/α/λ run −1…1 and are matched against the client. Auto-derived on import — override here if needed.',
          'σ/α/λ van de −1 a 1 y se comparan con el cliente. Se derivan al importar — ajustá acá si hace falta.',
        )}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t.admin.sigma}</label>
          <input
            type="number"
            step={0.05}
            min={-1}
            max={1}
            className={inputCls}
            value={draft.sigmaLoad}
            onChange={(e) => set('sigmaLoad', num(e.target.value))}
          />
        </div>
        <div>
          <label className={labelCls}>{t.admin.alpha}</label>
          <input
            type="number"
            step={0.05}
            min={-1}
            max={1}
            className={inputCls}
            value={draft.alphaLoad}
            onChange={(e) => set('alphaLoad', num(e.target.value))}
          />
        </div>
        <div>
          <label className={labelCls}>{t.admin.lambda}</label>
          <input
            type="number"
            step={0.05}
            min={-1}
            max={1}
            className={inputCls}
            value={draft.lambdaLoad}
            onChange={(e) => set('lambdaLoad', num(e.target.value))}
          />
        </div>
        <div>
          <label className={labelCls}>{t.admin.liquidityTier}</label>
          <select
            className={inputCls}
            value={draft.liquidityTier}
            onChange={(e) => set('liquidityTier', num(e.target.value, 1) as 1 | 2 | 3 | 4)}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.admin.lockupMonths}</label>
          <input
            type="number"
            min={0}
            step={1}
            className={inputCls}
            value={draft.lockupMonths}
            onChange={(e) => set('lockupMonths', num(e.target.value))}
          />
        </div>
      </div>

      {/* Visibility */}
      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
        <label className="flex items-center gap-2.5 text-sm text-text">
          <input
            type="checkbox"
            checked={draft.visible}
            onChange={(e) => set('visible', e.target.checked)}
            className="h-4 w-4 accent-teal"
          />
          {t.admin.visibleLabel}
        </label>
        <label className="flex items-center gap-2.5 text-sm text-text">
          <input
            type="checkbox"
            checked={draft.emphasized}
            onChange={(e) => set('emphasized', e.target.checked)}
            className="h-4 w-4 accent-teal"
          />
          {t.admin.emphasizedLabel}
        </label>
      </div>

      {/* Per-class asset details — bucketed into labelled sub-sections */}
      <h3 className="mt-8 font-mono text-xs uppercase tracking-[0.14em] text-muted">
        {t.admin.detailsSection}
      </h3>
      <p className="mt-1 text-xs text-muted">{t.admin.detailsHint}</p>
      <div className="mt-4 space-y-6">
        {groupedSpecs(specs).map((group) => (
          <div key={group.en}>
            <p className={subLabel}>{pick(lang, group.en, group.es)}</p>
            <div className="mt-2.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {group.specs.map((s) => {
                const label = pick(lang, s.en, s.es)
                const long = LONG_FIELDS.has(s.key)
                return (
                  <div key={s.key} className={long ? 'sm:col-span-2' : undefined}>
                    <label className={labelCls}>
                      {label}
                      {fetchSet.has(s.key) && (
                        <span
                          title={t.admin.fetchTagTitle}
                          className="ml-1.5 inline-block rounded bg-teal/12 px-1 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-wide text-teal"
                        >
                          ⚡ {t.admin.fetchTag}
                        </span>
                      )}
                    </label>
                    {long ? (
                      <textarea
                        rows={2}
                        className={inputCls}
                        value={draft.details[s.key] ?? ''}
                        onChange={(e) => setDetail(s.key, e.target.value)}
                      />
                    ) : (
                      <input
                        className={inputCls}
                        value={draft.details[s.key] ?? ''}
                        onChange={(e) => setDetail(s.key, e.target.value)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Attached documents (reports, term sheets, …) */}
      <InstrumentDocs instrumentId={draft.id} editable />

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:text-text"
        >
          {t.admin.cancel}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!draft.name.trim()}
          className="rounded-xl bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.admin.save}
        </button>
      </div>
    </div>
  )
}

// ── Console ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const t = useT()
  const { lang } = useLang()
  const { instruments, upsert, remove, removeMany } = useCatalog()
  const [regionFilter, setRegionFilter] = useState<Region | 'all'>('all')
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [kindFilter, setKindFilter] = useState<string | 'all'>('all')
  const [visFilter, setVisFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  // The subclasses on offer for the chosen class. Only surfaced once a class is
  // picked — the union across every class is a long, meaningless list. Keyed by
  // the ENGLISH label rather than the id: global 'Corporate bond' and local
  // 'Bono corporativo' are separate ids that read identically, and two chips
  // reading "Corporate bond" is just confusing — one chip selects both.
  const filterKinds = useMemo<{ en: string; es: string }[]>(() => {
    if (filter === 'all') return []
    const regions: Region[] = regionFilter === 'all' ? ['global', 'local'] : [regionFilter]
    const out = new Map<string, { en: string; es: string }>()
    for (const r of regions) {
      if (!(categoriesForRegion(r) as string[]).includes(filter as string)) continue
      for (const s of subclassesFor(r, filter as Category)) if (!out.has(s.en)) out.set(s.en, { en: s.en, es: s.es })
    }
    return [...out.values()]
  }, [regionFilter, filter])

  // Drop a Type filter that no longer belongs to the chosen market/class.
  useEffect(() => {
    if (kindFilter !== 'all' && !filterKinds.some((s) => s.en === kindFilter)) setKindFilter('all')
  }, [filterKinds, kindFilter])

  const shown = useMemo(
    () =>
      instruments.filter((i) => {
        const region = i.region ?? 'global'
        // Resolve through the registry so a legacy free-typed kind still matches
        // the subclass it aliases to.
        const kindEn = subclassFor(region, i.assetClass, i.kind)?.en ?? i.kind
        return (
          (regionFilter === 'all' || region === regionFilter) &&
          (filter === 'all' || i.assetClass === filter) &&
          (kindFilter === 'all' || kindEn === kindFilter) &&
          (visFilter === 'all' || (visFilter === 'visible' ? i.visible : !i.visible))
        )
      }),
    [instruments, regionFilter, filter, kindFilter, visFilter],
  )

  // Category chips reflect the selected market; 'all' shows the union (local-only
  // categories appended after the global ones).
  const globalCats = categoriesForRegion('global')
  const filterCats: Category[] =
    regionFilter === 'all'
      ? [...globalCats, ...categoriesForRegion('local').filter((c) => !(globalCats as string[]).includes(c))]
      : categoriesForRegion(regionFilter)

  const pickRegion = (r: Region | 'all') => {
    setRegionFilter(r)
    // Drop a class filter that no longer belongs to the chosen market.
    if (r !== 'all' && filter !== 'all' && !(categoriesForRegion(r) as string[]).includes(filter)) {
      setFilter('all')
    }
  }

  const handleDelete = (inst: ManagedInstrument) => {
    if (!window.confirm(t.admin.deleteConfirm(inst.name))) return
    remove(inst.id)
    if (editingId === inst.id) setEditingId(null)
  }

  // Bulk-delete everything currently in view, guarded by typing the confirm word.
  const confirmWordOk = confirmText.trim().toLowerCase() === t.admin.bulkWord.toLowerCase()
  const runBulkDelete = () => {
    if (!confirmWordOk || shown.length === 0) return
    removeMany(shown.map((i) => i.id))
    setBulkOpen(false)
    setConfirmText('')
    setEditingId(null)
    setAdding(false)
  }

  const vec = (i: ManagedInstrument) =>
    `σ ${i.sigmaLoad >= 0 ? '+' : ''}${i.sigmaLoad.toFixed(2)} · α ${i.alphaLoad >= 0 ? '+' : ''}${i.alphaLoad.toFixed(2)} · λ ${i.lambdaLoad >= 0 ? '+' : ''}${i.lambdaLoad.toFixed(2)}`

  // Category-appropriate quick facts for the list subtitle (local rows only);
  // global rows fall back to the σ/α/λ vector.
  const factLabels = {
    common: t.admin.shareCommon,
    preferred: t.admin.sharePreferred,
    yrs: t.admin.yrsShort,
  }
  const quickFacts = (i: ManagedInstrument): string | null =>
    localQuickFacts(i, factLabels) || null

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <AdminNav />

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-text">{t.admin.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.admin.subtitle}</p>
      <p className="mt-1 font-mono text-xs text-muted tnum">
        {t.admin.count(shown.length, instruments.length)}
      </p>

      {/* Actions — right-aligned, distinct from the filters below */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setAdding(true)
            setEditingId(null)
          }}
          className="rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
        >
          + {t.admin.add}
        </button>
      </div>


      {/* Filter panel — Market · Visibility · Category, grouped and labeled */}
      <div className="mt-4 rounded-2xl border border-border bg-surface/60 p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2.5">
            <span className={filterGroupLabel}>{t.admin.region}</span>
            <div className={segmentedCls}>
              {(['all', 'global', 'local'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => pickRegion(r)}
                  className={segBtn(regionFilter === r)}
                >
                  {r === 'all' ? t.admin.visAll : regionLabel(r, lang)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className={filterGroupLabel}>{t.admin.visibility}</span>
            <div className={segmentedCls}>
              {(['all', 'visible', 'hidden'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisFilter(v)}
                  className={segBtn(visFilter === v)}
                >
                  {v === 'all'
                    ? t.admin.visAll
                    : v === 'visible'
                      ? t.admin.visVisible
                      : t.admin.visHidden}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setConfirmText('')
              setBulkOpen(true)
            }}
            disabled={shown.length === 0}
            className="ml-auto rounded-full border border-red/40 bg-red/5 px-3.5 py-1.5 text-sm font-medium text-red transition-colors hover:bg-red/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.admin.deleteFiltered(shown.length)}
          </button>
        </div>

        {/* Category chips — reflect the selected market */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <span className={`${filterGroupLabel} mr-1`}>{t.admin.category}</span>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={chipCls(filter === 'all')}
          >
            {t.admin.filterAll}
          </button>
          {filterCats.map((c) => {
            const catRegion: Region = isLocalCategory(c) ? 'local' : 'global'
            return (
              <button key={c} type="button" onClick={() => setFilter(c)} className={chipCls(filter === c)}>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colorForCategory(c, catRegion) }}
                />
                {categoryLabel(c, catRegion, lang)}
              </button>
            )
          })}
        </div>

        {/* Subclass chips — narrow a class down to one instrument type. */}
        {filterKinds.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <span className={`${filterGroupLabel} mr-1`}>{t.admin.kind}</span>
            <button type="button" onClick={() => setKindFilter('all')} className={chipCls(kindFilter === 'all')}>
              {t.admin.filterAll}
            </button>
            {filterKinds.map((s) => (
              <button
                key={s.en}
                type="button"
                onClick={() => setKindFilter(s.en)}
                className={chipCls(kindFilter === s.en)}
              >
                {pick(lang, s.en, s.es)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk-delete confirmation — must type the word to arm the button */}
      {bulkOpen && (
        <div className="mt-3 rounded-2xl border border-red/30 bg-red/[0.04] p-5 shadow-soft">
          <h3 className="text-sm font-semibold text-text">{t.admin.bulkTitle}</h3>
          <p className="mt-1 text-sm text-muted">{t.admin.bulkBody(shown.length)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runBulkDelete()}
              placeholder={t.admin.bulkWord}
              className="w-48 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-text shadow-soft outline-none focus:ring-2 focus:ring-red/40"
            />
            <span className="text-xs text-muted">{t.admin.bulkPrompt(t.admin.bulkWord)}</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkOpen(false)
                  setConfirmText('')
                }}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-text"
              >
                {t.admin.cancel}
              </button>
              <button
                type="button"
                onClick={runBulkDelete}
                disabled={!confirmWordOk || shown.length === 0}
                className="rounded-xl bg-red px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.admin.bulkConfirm(shown.length)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk import from a spreadsheet */}
      <ImportInstruments />

      {/* Per-company logos for local issuers (Parqet only covers US tickers) */}
      <div className="mt-4">
        <CompanyLogos />
      </div>

      {/* New-instrument form */}
      {adding && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-text">{t.admin.newTitle}</h2>
          <InstrumentForm
            initial={newInstrument()}
            onSave={(item) => {
              upsert(item)
              setAdding(false)
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {/* Instrument list */}
      <ul className="mt-6 space-y-2">
        {shown.length === 0 && <p className="py-6 text-sm text-muted">{t.admin.noInstruments}</p>}
        {shown.map((inst) => (
          <li key={inst.id}>
            <div
              className={`flex items-center gap-3 rounded-2xl border bg-surface px-4 py-3 shadow-soft ${
                inst.visible ? 'border-border' : 'border-border/60 opacity-60'
              } ${editingId === inst.id ? 'border-teal/40' : ''}`}
            >
              <input
                type="checkbox"
                checked={inst.visible}
                onChange={() => upsert({ ...inst, visible: !inst.visible })}
                title={t.admin.visibleTitle}
                aria-label={t.admin.visibleTitle}
                className="h-4 w-4 shrink-0 accent-teal"
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorForCategory(inst.assetClass, inst.region ?? 'global') }}
              />
              {/* Click anywhere on the identity to open the editable detail form. */}
              <button
                type="button"
                aria-expanded={editingId === inst.id}
                onClick={() => {
                  setEditingId(editingId === inst.id ? null : inst.id)
                  setAdding(false)
                }}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-sm font-medium text-text">{inst.name}</span>
                  {inst.ticker && (
                    <span className="shrink-0 font-mono text-xs text-muted">{inst.ticker}</span>
                  )}
                  {inst.kind && (
                    <span className="shrink-0 rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {kindLabel(inst.kind, lang, inst.region ?? 'global', inst.assetClass)}
                    </span>
                  )}
                  {(inst.region ?? 'global') === 'local' && (
                    <span className="shrink-0 rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {regionLabel('local', lang)}
                    </span>
                  )}
                  {inst.emphasized && (
                    <span className="shrink-0 rounded-md bg-teal/12 px-1.5 py-0.5 text-[10px] font-medium text-teal">
                      {t.admin.emphasized}
                    </span>
                  )}
                  {!inst.visible && (
                    <span className="shrink-0 rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {t.admin.hidden}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted tnum">
                  {categoryLabel(inst.assetClass, inst.region ?? 'global', lang)} ·{' '}
                  {quickFacts(inst) ?? vec(inst)}
                </p>
              </button>
              <span
                aria-hidden
                className={`shrink-0 text-muted transition-transform duration-200 ${
                  editingId === inst.id ? 'rotate-90' : ''
                }`}
              >
                ›
              </span>
              <button
                type="button"
                onClick={() => handleDelete(inst)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted/60 transition-colors hover:bg-red/10 hover:text-red"
              >
                {t.admin.delete}
              </button>
            </div>

            {editingId === inst.id && (
              <div className="mt-2">
                <InstrumentForm
                  initial={inst}
                  onSave={(item) => {
                    upsert(item)
                    setEditingId(null)
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      </div>
    </div>
  )
}
