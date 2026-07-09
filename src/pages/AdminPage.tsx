import { useMemo, useState } from 'react'
import { ASSET_CLASSES, ASSET_CLASS_COLORS, type AssetClass } from '../lib/instruments'
import {
  ASSET_FIELD_SPECS,
  useCatalog,
  type ManagedInstrument,
} from '../lib/catalog'
import {
  fetchInstrumentData,
  getMarketDataConfig,
  setMarketDataConfig,
  type EquityProviderId,
} from '../lib/marketData'
import { useLang, useT } from '../i18n/i18n'
import { assetClassLabel } from '../i18n/content'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function newInstrument(): ManagedInstrument {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `inst_${Date.now().toString(36)}`,
    name: '',
    ticker: '',
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

// ── Market-data source settings (collapsible) ────────────────────────────────

function MarketDataSettings() {
  const t = useT()
  const [cfg, setCfg] = useState(getMarketDataConfig)
  const [saved, setSaved] = useState(false)

  const save = () => {
    setMarketDataConfig(cfg)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <details className="mt-6 rounded-2xl border border-border bg-surface px-5 py-4 shadow-soft">
      <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-[0.14em] text-muted transition-colors hover:text-text">
        {t.admin.dataSourceTitle}
      </summary>
      <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">{t.admin.dataSourceHint}</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t.admin.provider}</label>
          <select
            className={inputCls}
            value={cfg.equityProvider}
            onChange={(e) => {
              setCfg((c) => ({ ...c, equityProvider: e.target.value as EquityProviderId }))
              setSaved(false)
            }}
          >
            <option value="none">{t.admin.providerNone}</option>
            <option value="fmp">Financial Modeling Prep</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.admin.apiKey}</label>
          <input
            type="password"
            className={inputCls}
            value={cfg.apiKey}
            disabled={cfg.equityProvider === 'none'}
            onChange={(e) => {
              setCfg((c) => ({ ...c, apiKey: e.target.value }))
              setSaved(false)
            }}
          />
          <p className="mt-1 text-[11px] text-muted">{t.admin.apiKeyHint}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
        >
          {t.admin.saveSettings}
        </button>
        {saved && <span className="text-xs font-medium text-teal">{t.admin.settingsSaved}</span>}
      </div>
    </details>
  )
}

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

  const set = <K extends keyof ManagedInstrument>(key: K, value: ManagedInstrument[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  // Autofill the detail sheet from a market-data source (ticker/ISIN). The
  // provider is a no-op in the static build (see lib/marketData.ts) and reports
  // "unavailable"; the Phase-2 backend swaps in a real provider transparently.
  const autofill = async () => {
    setFetching(true)
    setFetchMsg(null)
    const sym = draft.ticker.trim() || (draft.isin ?? '').trim()
    const res = await fetchInstrumentData({
      ticker: draft.ticker.trim(),
      isin: (draft.isin ?? '').trim(),
      assetClass: draft.assetClass,
    })
    setFetching(false)
    if (res.ok) {
      const n = Object.keys(res.fields).length
      setDraft((d) => ({ ...d, details: { ...d.details, ...res.fields } }))
      setFetchMsg(n > 0 ? t.admin.autofillFilled(n) : t.admin.autofillNotFound(sym))
    } else {
      setFetchMsg(
        res.reason === 'no_key'
          ? t.admin.autofillNoKey
          : res.reason === 'unsupported'
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

  const specs = ASSET_FIELD_SPECS[draft.assetClass]

  const save = () => {
    if (!draft.name.trim()) return
    onSave({
      ...draft,
      name: draft.name.trim(),
      ticker: draft.ticker.trim() || 'OTC',
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
          <label className={labelCls}>{t.admin.assetClass}</label>
          <select
            className={inputCls}
            value={draft.assetClass}
            onChange={(e) => set('assetClass', e.target.value as AssetClass)}
          >
            {ASSET_CLASSES.map((c) => (
              <option key={c} value={c}>
                {assetClassLabel(c, lang)}
              </option>
            ))}
          </select>
        </div>
        {/* Autofill from a market-data source (backend-powered — Phase 2) */}
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
              <label className={labelCls}>{label}</label>
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
  const { instruments, upsert, remove, reset } = useCatalog()
  const [filter, setFilter] = useState<AssetClass | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const shown = useMemo(
    () => (filter === 'all' ? instruments : instruments.filter((i) => i.assetClass === filter)),
    [instruments, filter],
  )

  const handleDelete = (inst: ManagedInstrument) => {
    if (!window.confirm(t.admin.deleteConfirm(inst.name))) return
    remove(inst.id)
    if (editingId === inst.id) setEditingId(null)
  }

  const handleReset = () => {
    if (!window.confirm(t.admin.resetConfirm)) return
    setEditingId(null)
    setAdding(false)
    reset()
  }

  const vec = (i: ManagedInstrument) =>
    `σ ${i.sigmaLoad >= 0 ? '+' : ''}${i.sigmaLoad.toFixed(2)} · α ${i.alphaLoad >= 0 ? '+' : ''}${i.alphaLoad.toFixed(2)} · λ ${i.lambdaLoad >= 0 ? '+' : ''}${i.lambdaLoad.toFixed(2)}`

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

      <MarketDataSettings />

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-all ${
            filter === 'all'
              ? 'border-transparent bg-teal/15 font-medium text-teal shadow-soft'
              : 'border-border bg-surface text-muted hover:text-text'
          }`}
        >
          {t.admin.filterAll}
        </button>
        {ASSET_CLASSES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all ${
              filter === c
                ? 'border-transparent bg-teal/15 font-medium text-teal shadow-soft'
                : 'border-border bg-surface text-muted hover:text-text'
            }`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: ASSET_CLASS_COLORS[c] }}
            />
            {assetClassLabel(c, lang)}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-red"
          >
            {t.admin.resetDefaults}
          </button>
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
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ASSET_CLASS_COLORS[inst.assetClass] }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">{inst.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted">{inst.ticker}</span>
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
                  {assetClassLabel(inst.assetClass, lang)} · {vec(inst)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(editingId === inst.id ? null : inst.id)
                    setAdding(false)
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text"
                >
                  {t.admin.edit}
                </button>
                <button
                  type="button"
                  onClick={() => upsert({ ...inst, visible: !inst.visible })}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface2 hover:text-text"
                >
                  {inst.visible ? t.admin.hide : t.admin.show}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(inst)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted/60 transition-colors hover:bg-red/10 hover:text-red"
                >
                  {t.admin.delete}
                </button>
              </div>
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
