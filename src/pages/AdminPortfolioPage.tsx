import { useEffect, useState } from 'react'
import { usePortfolioModel } from '../lib/portfolioModelConfig'
import { type PortfolioModel } from '../lib/portfolio'
import type { RiskLevel } from '../lib/scoring'
import { useLang, useT } from '../i18n/i18n'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

const pick = (lang: 'en' | 'es', en: string, es: string) => (lang === 'es' ? es : en)
const clone = (m: PortfolioModel): PortfolioModel => JSON.parse(JSON.stringify(m))
const numCls =
  'w-20 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-right text-sm text-text tnum shadow-soft outline-none focus:ring-2 focus:ring-teal/40'
const label = 'font-mono text-[10px] uppercase tracking-wider text-muted'

// A labelled numeric field. `scale` shows the stored fraction as a percent.
function Field({
  name, hint, value, onChange, scale = 1, step = 1, suffix,
}: {
  name: string; hint?: string; value: number; onChange: (v: number) => void; scale?: number; step?: number; suffix?: string
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-sm text-text">{name}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          step={step}
          className={numCls}
          value={Math.round(value * scale * 1000) / 1000}
          onChange={(e) => onChange((Number(e.target.value) || 0) / scale)}
        />
        {suffix && <span className="w-4 text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  )
}

export default function AdminPortfolioPage() {
  const t = useT()
  const { lang } = useLang()
  const { model, setModel, reset } = usePortfolioModel()
  const [draft, setDraft] = useState<PortfolioModel>(() => clone(model))
  useEffect(() => setDraft(clone(model)), [model])
  const set = (p: Partial<PortfolioModel>) => setDraft((d) => ({ ...d, ...p }))
  const setDur = (lvl: RiskLevel, v: number) =>
    setDraft((d) => ({ ...d, bandDuration: { ...d.bandDuration, [lvl]: v } }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(model)

  const steps: [string, string][] = [
    [pick(lang, '1 · The split', '1 · La distribución'), pick(lang,
      "The client's 1–5 band sets the % per asset class (edit those on Risk bands). Optimization happens WITHIN each class — the split itself is the admin's preset.",
      'La banda 1–5 del cliente fija el % por clase de activo (se edita en Bandas de riesgo). La optimización ocurre DENTRO de cada clase — la distribución es el preajuste del admin.')],
    [pick(lang, '2 · Within a class', '2 · Dentro de una clase'), pick(lang,
      'Equities: mean-variance — weights that maximize return per unit of risk. Bonds: reward yield, target the band’s duration. Funds & notes: weighted by how close they sit to the client’s level.',
      'Renta variable: media-varianza — pesos que maximizan retorno por unidad de riesgo. Bonos: premian rendimiento y apuntan a la duración de la banda. Fondos y notas: ponderados por cercanía al nivel del cliente.')],
    [pick(lang, '3 · The risk ceiling', '3 · El techo de riesgo'), pick(lang,
      'Instruments more than “ceiling” levels above the client’s band are excluded, so the portfolio’s risk stays near the client’s.',
      'Se excluyen los instrumentos que superan la banda del cliente por más de “techo” niveles, para que el riesgo de la cartera quede cerca del cliente.')],
    [pick(lang, '4 · Expected return', '4 · Retorno esperado'), pick(lang,
      'Equities blend analyst price-target upside with a CAPM estimate (risk-free + β × equity premium). Bonds use yield-to-worst; local instruments use the bulletin’s estimated yield.',
      'Renta variable combina el potencial del precio objetivo con una estimación CAPM (tasa libre + β × prima). Los bonos usan yield-to-worst; los locales el rendimiento estimado del boletín.')],
    [pick(lang, '5 · Risk & correlation', '5 · Riesgo y correlación'), pick(lang,
      'Volatility comes from implied vol / duration + credit. Names correlate within a class and across classes; the portfolio’s 1–5 risk is its volatility bucket.',
      'La volatilidad sale de la vol. implícita / duración + crédito. Los activos correlacionan dentro y entre clases; el riesgo 1–5 de la cartera es su banda de volatilidad.')],
    [pick(lang, '6 · Advisor control', '6 · Control del asesor'), pick(lang,
      'The advisor drags instruments in from the master list, edits weights, removes names, and sizes the book to a capital amount.',
      'El asesor arrastra instrumentos desde la lista maestra, edita pesos, quita nombres y dimensiona la cartera a un monto de capital.')],
  ]

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <AdminNav />

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text">{t.adminPortfolio.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.adminPortfolio.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => window.confirm(t.adminPortfolio.resetConfirm) && reset()}
            className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-red"
          >
            {t.adminPortfolio.reset}
          </button>
        </div>

        {/* Tutorial */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <p className={label}>{t.adminPortfolio.howItWorks}</p>
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {steps.map(([h, body]) => (
              <div key={h}>
                <p className="text-sm font-semibold text-text">{h}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Params */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <p className={label}>{pick(lang, 'Expected return', 'Retorno esperado')}</p>
            <div className="mt-2 divide-y divide-border/50">
              <Field name={pick(lang, 'Risk-free rate', 'Tasa libre de riesgo')} value={draft.rf} onChange={(v) => set({ rf: v })} scale={100} step={0.25} suffix="%" />
              <Field name={pick(lang, 'Equity risk premium', 'Prima de riesgo (acciones)')} value={draft.erp} onChange={(v) => set({ erp: v })} scale={100} step={0.25} suffix="%" />
              <Field name={pick(lang, 'Analyst vs CAPM blend', 'Mezcla analista vs CAPM')} hint={pick(lang, '0 = all CAPM · 1 = all analyst', '0 = todo CAPM · 1 = todo analista')} value={draft.analystBlend} onChange={(v) => set({ analystBlend: Math.max(0, Math.min(1, v)) })} step={0.05} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <p className={label}>{pick(lang, 'Selection', 'Selección')}</p>
            <div className="mt-2 divide-y divide-border/50">
              <Field name={pick(lang, 'Instruments per class', 'Instrumentos por clase')} value={draft.assetsPerClass} onChange={(v) => set({ assetsPerClass: Math.max(1, Math.round(v)) })} />
              <Field name={pick(lang, 'Max single-name weight', 'Peso máx. por nombre')} value={draft.nameCap} onChange={(v) => set({ nameCap: Math.max(0.05, Math.min(1, v)) })} scale={100} step={1} suffix="%" />
              <Field name={pick(lang, 'Risk-level ceiling (band + N)', 'Techo de nivel (banda + N)')} value={draft.levelCeiling} onChange={(v) => set({ levelCeiling: Math.max(0, Math.round(v)) })} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <p className={label}>{pick(lang, 'Correlation', 'Correlación')}</p>
            <div className="mt-2 divide-y divide-border/50">
              <Field name={pick(lang, 'Within a class', 'Dentro de una clase')} value={draft.rhoWithin} onChange={(v) => set({ rhoWithin: Math.max(0, Math.min(0.99, v)) })} step={0.05} />
              <Field name={pick(lang, 'Across classes', 'Entre clases')} value={draft.rhoAcross} onChange={(v) => set({ rhoAcross: Math.max(0, Math.min(0.99, v)) })} step={0.05} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <p className={label}>{pick(lang, 'Bond duration target (years)', 'Duración objetivo de bonos (años)')}</p>
            <div className="mt-2 divide-y divide-border/50">
              {([1, 2, 3, 4, 5] as RiskLevel[]).map((lvl) => (
                <Field key={lvl} name={t.result.level(lvl)} value={draft.bandDuration[lvl]} onChange={(v) => setDur(lvl, Math.max(0, v))} step={0.5} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setModel(clone(draft))}
            disabled={!dirty}
            className="rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.adminPortfolio.save}
          </button>
          {dirty && <span className="text-xs text-muted">{pick(lang, 'Unsaved changes', 'Cambios sin guardar')}</span>}
        </div>
      </div>
    </div>
  )
}
