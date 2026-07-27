import { useEffect, useState } from 'react'
import { usePortfolioModel } from '../lib/portfolioModelConfig'
import { type CorrelationModel, type FactorRho, type PortfolioModel } from '../lib/portfolio'
import type { RiskLevel } from '../lib/scoring'
import { useLang, useT } from '../i18n/i18n'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

const pick = (lang: 'en' | 'es', en: string, es: string) => (lang === 'es' ? es : en)
const clone = (m: PortfolioModel): PortfolioModel => JSON.parse(JSON.stringify(m))
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
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
  const setC = (p: Partial<CorrelationModel>) =>
    setDraft((d) => ({ ...d, correlation: { ...d.correlation, ...p } }))
  const setRho = (p: Partial<FactorRho>) =>
    setDraft((d) => ({ ...d, correlation: { ...d.correlation, factorRho: { ...d.correlation.factorRho, ...p } } }))
  const C = draft.correlation
  const dirty = JSON.stringify(draft) !== JSON.stringify(model)

  const factors: [string, string][] = [
    [pick(lang, 'Global equity', 'Renta variable global'), pick(lang,
      'Loading = β × market vol for a listed share. Structured notes and funds load a fixed share of their own volatility, since their underlying’s β isn’t in the catalog.',
      'Carga = β × vol. del mercado para una acción listada. Las notas estructuradas y los fondos cargan una porción fija de su propia volatilidad, porque la β de su subyacente no está en el catálogo.')],
    [pick(lang, 'Rates', 'Tasas'), pick(lang,
      'Loading = modified duration × rate vol. This is what makes duration, not asset class, decide how much two bonds move together.',
      'Carga = duración modificada × vol. de tasas. Esto hace que la duración, y no la clase de activo, decida cuánto se mueven juntos dos bonos.')],
    [pick(lang, 'Credit', 'Crédito'), pick(lang,
      'Loading = the vol implied by the credit rating. A BB bond shares far more spread risk with another BB bond than with a AAA.',
      'Carga = la vol. implícita en la calificación. Un bono BB comparte mucho más riesgo de spread con otro BB que con un AAA.')],
    [pick(lang, 'Local market', 'Mercado local'), pick(lang,
      'Local instruments sit on their own factor — Guaraní rates and local credit are not US rates, so a global β would overstate how much they move with the world.',
      'Los instrumentos locales tienen su propio factor — las tasas en guaraníes y el crédito local no son tasas de EE. UU., así que una β global exageraría cuánto se mueven con el mundo.')],
  ]

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
      'Volatility comes from implied vol / duration + credit. Correlation is NOT one number per class pair — each instrument is decomposed into four risk factors (see below), so what two names share decides how much they diversify. The portfolio’s 1–5 risk is its volatility bucket.',
      'La volatilidad sale de la vol. implícita / duración + crédito. La correlación NO es un número por par de clases — cada instrumento se descompone en cuatro factores de riesgo (ver abajo), así que lo que dos activos comparten decide cuánto diversifican. El riesgo 1–5 de la cartera es su banda de volatilidad.')],
    [pick(lang, '6 · Advisor control', '6 · Control del asesor'), pick(lang,
      'The advisor drags instruments in from the master list, sets how many names the suggestion holds in total (split across classes by the band’s mix), edits weights, removes names, re-optimizes over whatever is left, and sizes the book to a capital amount.',
      'El asesor arrastra instrumentos desde la lista maestra, define cuántos nombres tiene la sugerencia en total (se reparten entre clases según la mezcla de la banda), edita pesos, quita nombres, reoptimiza sobre lo que queda y dimensiona la cartera a un monto de capital.')],
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
              <Field name={pick(lang, 'Instruments in the portfolio', 'Instrumentos en la cartera')} hint={pick(lang, 'split across classes by the band’s mix', 'se reparten entre clases según la mezcla de la banda')} value={draft.totalAssets} onChange={(v) => set({ totalAssets: Math.max(1, Math.round(v)) })} />
              <Field name={pick(lang, 'Max single-name weight', 'Peso máx. por nombre')} value={draft.nameCap} onChange={(v) => set({ nameCap: Math.max(0.05, Math.min(1, v)) })} scale={100} step={1} suffix="%" />
              <Field name={pick(lang, 'Risk-level ceiling (band + N)', 'Techo de nivel (banda + N)')} value={draft.levelCeiling} onChange={(v) => set({ levelCeiling: Math.max(0, Math.round(v)) })} />
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

        {/* ── Correlation: the four-factor model ─────────────────────────────── */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <p className={label}>{pick(lang, 'Correlation — risk factors', 'Correlación — factores de riesgo')}</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {pick(lang,
              'Two instruments do not correlate because they share a label — they correlate because they are exposed to the same thing. Each instrument’s volatility is split across four common factors, plus what is left over (its single-name risk). A 3-year A-rated bond and a 20-year Treasury share the rates factor only in proportion to their duration, so they come out far less correlated than two 20-year bonds; a β 1.4 name loads more on the equity factor than a β 0.6 one.',
              'Dos instrumentos no correlacionan por compartir una etiqueta — correlacionan porque están expuestos a lo mismo. La volatilidad de cada instrumento se reparte entre cuatro factores comunes, más lo que sobra (su riesgo idiosincrático). Un bono A a 3 años y un Treasury a 20 comparten el factor de tasas solo en proporción a su duración, así que quedan mucho menos correlacionados que dos bonos a 20 años; un nombre con β 1,4 carga más sobre el factor de renta variable que uno con β 0,6.')}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {factors.map(([h, body]) => (
              <div key={h}>
                <p className="text-sm font-semibold text-text">{h}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className={label}>{pick(lang, 'Factor volatility', 'Volatilidad de los factores')}</p>
              <div className="mt-2 divide-y divide-border/50">
                <Field name={pick(lang, 'Equity market vol (σ)', 'Vol. del mercado accionario (σ)')} hint={pick(lang, 'also converts β into volatility', 'también convierte β en volatilidad')} value={C.marketVol} onChange={(v) => setC({ marketVol: Math.max(0.01, v) })} scale={100} step={1} suffix="%" />
                <Field name={pick(lang, 'Rate vol per year of duration', 'Vol. de tasas por año de duración')} value={C.rateVol} onChange={(v) => setC({ rateVol: Math.max(0, v) })} scale={100} step={0.1} suffix="%" />
              </div>
              <p className={`mt-5 ${label}`}>{pick(lang, 'Residual co-movement', 'Co-movimiento residual')}</p>
              <div className="mt-2 divide-y divide-border/50">
                <Field name={pick(lang, 'Same sector (equities)', 'Mismo sector (acciones)')} value={C.sameSector} onChange={(v) => setC({ sameSector: clamp01(v) })} step={0.05} />
                <Field name={pick(lang, 'Same issuer', 'Mismo emisor')} hint={pick(lang, 'a company’s bond vs. its stock', 'el bono de una empresa vs. su acción')} value={C.sameIssuer} onChange={(v) => setC({ sameIssuer: clamp01(v) })} step={0.05} />
              </div>
            </div>

            <div>
              <p className={label}>{pick(lang, 'Between factors', 'Entre factores')}</p>
              <div className="mt-2 divide-y divide-border/50">
                <Field name={pick(lang, 'Equity ↔ rates', 'Acciones ↔ tasas')} value={C.factorRho.mktRates} onChange={(v) => setRho({ mktRates: v })} step={0.05} />
                <Field name={pick(lang, 'Equity ↔ credit', 'Acciones ↔ crédito')} value={C.factorRho.mktCredit} onChange={(v) => setRho({ mktCredit: v })} step={0.05} />
                <Field name={pick(lang, 'Equity ↔ local', 'Acciones ↔ local')} value={C.factorRho.mktLocal} onChange={(v) => setRho({ mktLocal: v })} step={0.05} />
                <Field name={pick(lang, 'Rates ↔ credit', 'Tasas ↔ crédito')} value={C.factorRho.ratesCredit} onChange={(v) => setRho({ ratesCredit: v })} step={0.05} />
                <Field name={pick(lang, 'Rates ↔ local', 'Tasas ↔ local')} value={C.factorRho.ratesLocal} onChange={(v) => setRho({ ratesLocal: v })} step={0.05} />
                <Field name={pick(lang, 'Credit ↔ local', 'Crédito ↔ local')} value={C.factorRho.creditLocal} onChange={(v) => setRho({ creditLocal: v })} step={0.05} />
              </div>
              <p className={`mt-5 ${label}`}>{pick(lang, 'Assumed equity exposure', 'Exposición accionaria asumida')}</p>
              <div className="mt-2 divide-y divide-border/50">
                <Field name={pick(lang, 'Structured notes', 'Notas estructuradas')} value={C.noteEquityShare} onChange={(v) => setC({ noteEquityShare: clamp01(v) })} scale={100} step={5} suffix="%" />
                <Field name={pick(lang, 'Funds without a β', 'Fondos sin β')} value={C.fundEquityShare} onChange={(v) => setC({ fundEquityShare: clamp01(v) })} scale={100} step={5} suffix="%" />
                <Field name={pick(lang, 'Local → local factor', 'Local → factor local')} value={C.localShare} onChange={(v) => setC({ localShare: clamp01(v) })} scale={100} step={5} suffix="%" />
              </div>
            </div>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted">
            {pick(lang,
              'The factor correlations are checked for consistency before use — an impossible set (one that would imply a risk-free combination) is automatically shrunk toward independence rather than rejected, so the optimizer never solves a broken matrix.',
              'Las correlaciones entre factores se verifican antes de usarse — un conjunto imposible (que implicaría una combinación sin riesgo) se contrae automáticamente hacia la independencia en lugar de rechazarse, así el optimizador nunca resuelve una matriz inconsistente.')}
          </p>
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
