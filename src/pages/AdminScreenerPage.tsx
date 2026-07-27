import { useMemo, useState } from 'react'
import { useCatalog, type ManagedInstrument } from '../lib/catalog'
import {
  EQUITY_TRAITS,
  FI_TRAITS,
  RATING_LADDER,
  passes,
  ratingRank,
  type Bound,
  type Trait,
} from '../lib/traits'
import { useLang, useT } from '../i18n/i18n'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

// ---------------------------------------------------------------------------
// Screener — narrow the global catalog by trait, then publish that subset
// ---------------------------------------------------------------------------
// Advisors only ever see instruments flagged `visible`, so "which of these
// should advisors be offered" is exactly the visible flag. This page screens a
// class on its numeric traits (analyst upside, yield, duration, rating…), lets
// the admin confirm the selection, and writes visibility for the WHOLE class in
// one go — so the advisor's universe for that class becomes precisely the
// chosen subset.

type Cls = 'Equities' | 'Fixed income'

const pick = (lang: 'en' | 'es', en: string, es: string) => (lang === 'es' ? es : en)
const boundCls =
  'w-[54px] rounded-md border border-border bg-surface px-1.5 py-1 text-right font-mono text-xs text-text tnum outline-none focus:ring-2 focus:ring-teal/40'

function TraitRow({ trait, bound, onChange, lang }: { trait: Trait; bound: Bound; onChange: (b: Bound) => void; lang: 'en' | 'es' }) {
  const parse = (s: string) => (s.trim() === '' ? undefined : Number(s))
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 text-sm leading-tight text-text">
        {lang === 'es' ? trait.es : trait.en}
        {trait.unit && <span className="ml-1 font-mono text-[10px] text-muted">{trait.unit}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <input
          type="number"
          aria-label={`${lang === 'es' ? trait.es : trait.en} — min`}
          placeholder={pick(lang, 'min', 'mín')}
          value={bound.min ?? ''}
          onChange={(e) => onChange({ ...bound, min: parse(e.target.value) })}
          className={boundCls}
        />
        <span className="text-xs text-muted">–</span>
        <input
          type="number"
          aria-label={`${lang === 'es' ? trait.es : trait.en} — max`}
          placeholder={pick(lang, 'max', 'máx')}
          value={bound.max ?? ''}
          onChange={(e) => onChange({ ...bound, max: parse(e.target.value) })}
          className={boundCls}
        />
      </span>
    </div>
  )
}

export default function AdminScreenerPage() {
  const t = useT()
  const { lang } = useLang()
  const { instruments, addMany } = useCatalog()

  const [cls, setCls] = useState<Cls>('Equities')
  const [bounds, setBounds] = useState<Record<Cls, Record<string, Bound>>>({ 'Equities': {}, 'Fixed income': {} })
  const [sortKey, setSortKey] = useState<string>('')
  const [sortDesc, setSortDesc] = useState(true)
  const [msg, setMsg] = useState('')
  // Selection starts as whatever advisors can see today, so the page opens on
  // the current state rather than on an empty slate.
  const [picked, setPicked] = useState<Record<Cls, Set<string> | null>>({ 'Equities': null, 'Fixed income': null })

  const traits = cls === 'Equities' ? EQUITY_TRAITS : FI_TRAITS
  const classBounds = bounds[cls]

  const pool = useMemo(
    () => instruments.filter((i) => (i.region ?? 'global') === 'global' && i.assetClass === cls),
    [instruments, cls],
  )
  const selected = picked[cls] ?? new Set(pool.filter((i) => i.visible).map((i) => i.id))

  const matches = useMemo(() => {
    const m = pool.filter((i) => passes(i, traits, classBounds))
    if (!sortKey) return m
    const tr = traits.find((x) => x.key === sortKey)
    if (!tr) return m
    return m.slice().sort((a, b) => {
      const va = tr.get(a)
      const vb = tr.get(b)
      if (va == null) return 1
      if (vb == null) return -1
      return sortDesc ? vb - va : va - vb
    })
  }, [pool, traits, classBounds, sortKey, sortDesc])

  const setBound = (key: string, b: Bound) =>
    setBounds((prev) => ({ ...prev, [cls]: { ...prev[cls], [key]: b } }))
  const setPickedFor = (next: Set<string>) => setPicked((p) => ({ ...p, [cls]: next }))
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPickedFor(next)
  }

  // The rating filter is ordinal, not numeric — expose it as "at least X".
  const ratingBound = classBounds.rating ?? {}
  const minRating = ratingBound.max // ladder index: lower = better, so a cap = a floor on quality

  const clear = () => {
    setBounds((prev) => ({ ...prev, [cls]: {} }))
    setSortKey('')
    setMsg('')
  }

  const apply = () => {
    const changed = pool.filter((i) => i.visible !== selected.has(i.id))
    if (changed.length === 0) {
      setMsg(pick(lang, 'Nothing to change — advisors already see exactly this set.', 'Nada que cambiar — los asesores ya ven exactamente este conjunto.'))
      return
    }
    const label = cls === 'Equities' ? pick(lang, 'global equities', 'renta variable global') : pick(lang, 'global fixed income', 'renta fija global')
    const confirmMsg = pick(
      lang,
      `Advisors will see ${selected.size} of ${pool.length} ${label} instruments. ${changed.length} will change. Continue?`,
      `Los asesores verán ${selected.size} de ${pool.length} instrumentos de ${label}. Cambian ${changed.length}. ¿Continuar?`,
    )
    if (!window.confirm(confirmMsg)) return
    addMany(changed.map((i): ManagedInstrument => ({ ...i, visible: selected.has(i.id) })))
    setMsg(pick(lang, `Updated ${changed.length} instruments.`, `Se actualizaron ${changed.length} instrumentos.`))
  }

  const visibleNow = pool.filter((i) => i.visible).length
  const dirty = pool.some((i) => i.visible !== selected.has(i.id))

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <AdminNav />

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-text">{t.adminScreener.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{t.adminScreener.subtitle}</p>

        {/* Class picker */}
        <div className="mt-6 inline-flex rounded-full border border-border bg-surface p-0.5">
          {(['Equities', 'Fixed income'] as Cls[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setCls(c); setSortKey(''); setMsg('') }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${cls === c ? 'bg-teal/15 text-teal shadow-soft' : 'text-muted hover:text-text'}`}
            >
              {c === 'Equities' ? pick(lang, 'Global equities', 'Renta variable global') : pick(lang, 'Global fixed income', 'Renta fija global')}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 min-[1000px]:grid-cols-[352px_1fr]">
          {/* Filters */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{t.adminScreener.filters}</p>
              <button type="button" onClick={clear} className="text-xs text-muted transition-colors hover:text-teal">
                {t.adminScreener.clear}
              </button>
            </div>
            <div className="mt-2 divide-y divide-border/50">
              {traits
                .filter((tr) => tr.key !== 'rating')
                .map((tr) => (
                  <TraitRow key={tr.key} trait={tr} bound={classBounds[tr.key] ?? {}} onChange={(b) => setBound(tr.key, b)} lang={lang} />
                ))}
              {cls === 'Fixed income' && (
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-sm text-text">{pick(lang, 'Credit rating at least', 'Calificación mínima')}</span>
                  <select
                    value={minRating ?? ''}
                    onChange={(e) => setBound('rating', e.target.value === '' ? {} : { max: Number(e.target.value) })}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:ring-2 focus:ring-teal/40"
                  >
                    <option value="">{pick(lang, 'Any', 'Cualquiera')}</option>
                    {RATING_LADDER.map((r, idx) => (
                      <option key={r} value={idx}>{r}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-hairline pt-4">
              <p className="font-mono text-xs text-muted tnum">
                {t.adminScreener.matchCount(matches.length, pool.length)}
              </p>
              <p className="mt-1 font-mono text-xs text-muted tnum">
                {t.adminScreener.selectedCount(selected.size)} · {t.adminScreener.visibleNow(visibleNow)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPickedFor(new Set(matches.map((i) => i.id)))}
                  className="rounded-lg border border-teal/40 bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal transition-colors hover:bg-teal/20"
                >
                  {t.adminScreener.selectMatches}
                </button>
                <button
                  type="button"
                  onClick={() => setPickedFor(new Set([...selected, ...matches.map((i) => i.id)]))}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-text"
                >
                  {t.adminScreener.addMatches}
                </button>
                <button
                  type="button"
                  onClick={() => setPickedFor(new Set(pool.map((i) => i.id)))}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-text"
                >
                  {t.adminScreener.selectAll}
                </button>
              </div>
              <button
                type="button"
                onClick={apply}
                disabled={!dirty}
                className="mt-4 w-full rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.adminScreener.apply}
              </button>
              {msg && <p className="mt-2 text-xs text-teal">{msg}</p>}
            </div>
          </div>

          {/* Results */}
          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="w-8 py-2 pl-3" />
                    <th className="py-2 pr-3 text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                      {t.adminScreener.instrument}
                    </th>
                    {traits.map((tr) => (
                      <th key={tr.key} className="whitespace-nowrap px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (sortKey === tr.key) setSortDesc((s) => !s)
                            else { setSortKey(tr.key); setSortDesc(true) }
                          }}
                          className={`font-mono text-[10px] uppercase tracking-wider transition-colors hover:text-teal ${sortKey === tr.key ? 'text-teal' : 'text-muted'}`}
                        >
                          {lang === 'es' ? tr.es : tr.en}
                          {sortKey === tr.key && (sortDesc ? ' ↓' : ' ↑')}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map((i) => (
                    <tr key={i.id} className="border-b border-hairline last:border-0">
                      <td className="py-1.5 pl-3">
                        <input
                          type="checkbox"
                          checked={selected.has(i.id)}
                          onChange={() => toggle(i.id)}
                          aria-label={i.name}
                          className="h-4 w-4 accent-teal"
                        />
                      </td>
                      <td className="max-w-[260px] truncate py-1.5 pr-3">
                        <span className="text-text">{i.name}</span>
                        {i.ticker && <span className="ml-1.5 font-mono text-[11px] text-muted">{i.ticker}</span>}
                      </td>
                      {traits.map((tr) => {
                        const v = tr.get(i)
                        const txt =
                          tr.key === 'rating'
                            ? (i.details.creditRating ?? i.details.rating ?? '—')
                            : v == null
                              ? '—'
                              : v.toFixed(tr.dp ?? 1)
                        return (
                          <td key={tr.key} className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-xs text-muted tnum">
                            {txt}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {matches.length === 0 && (
                    <tr>
                      <td colSpan={traits.length + 2} className="py-10 text-center text-sm text-muted">
                        {t.adminScreener.noMatches}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Keep the ordinal helper reachable for tests / future callers.
export { ratingRank }
