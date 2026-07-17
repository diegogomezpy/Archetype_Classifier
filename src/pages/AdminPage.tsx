import { useMemo, useState } from 'react'
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
  localQuickFacts,
  supportsFetch,
  useCatalog,
  type ManagedInstrument,
} from '../lib/catalog'
import ImportBulletin from '../components/ImportBulletin'
import ImportRanking from '../components/ImportRanking'
import { fetchInstrumentData } from '../lib/marketData'
import { useLang, useT } from '../i18n/i18n'
import { categoryLabel, regionLabel } from '../i18n/content'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'
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
    setDraft((d) => ({ ...d, region: r, assetClass: categoriesForRegion(r)[0] }))

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
      const n = Object.keys(res.fields).length
      setDraft((d) => ({ ...d, details: { ...d.details, ...res.fields } }))
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

  const specs = fieldSpecsFor(region, draft.assetClass)
  const fetchSet = fetchableFields(draft.assetClass, region)

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
      {/* Identity & risk vector */}
      <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
        {t.admin.baseSection}
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
          <input
            className={inputCls}
            value={draft.kind ?? ''}
            placeholder={t.admin.kindPlaceholder}
            onChange={(e) => set('kind', e.target.value)}
          />
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
            onChange={(e) => set('assetClass', e.target.value as Category)}
          >
            {categoriesForRegion(region).map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c, region, lang)}
              </option>
            ))}
          </select>
        </div>
        {/* Autofill from a market-data source — only for classes that have one. */}
        {supportsFetch(draft.assetClass, region) && (
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

      {/* Per-class asset details */}
      <h3 className="mt-8 font-mono text-xs uppercase tracking-[0.14em] text-muted">
        {t.admin.detailsSection}
      </h3>
      <p className="mt-1 text-xs text-muted">{t.admin.detailsHint}</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {specs.map((s) => {
          const label = lang === 'es' ? s.es : s.en
          const long = s.key === 'description' || s.key === 'worstCase' || s.key === 'diversificationNote' || s.key === 'volatilityNote'
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
  const [visFilter, setVisFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const shown = useMemo(
    () =>
      instruments.filter((i) => {
        const region = i.region ?? 'global'
        return (
          (regionFilter === 'all' || region === regionFilter) &&
          (filter === 'all' || i.assetClass === filter) &&
          (visFilter === 'all' || (visFilter === 'visible' ? i.visible : !i.visible))
        )
      }),
    [instruments, regionFilter, filter, visFilter],
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

      {/* The two real loading paths: the boletín (local) and the research
          firm's equity ranking (global). Generic CSV import sits below. */}
      <ImportBulletin />
      <ImportRanking />

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
                      {inst.kind}
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
