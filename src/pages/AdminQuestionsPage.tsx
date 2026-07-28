import { useEffect, useRef, useState } from 'react'
import { AXES, useQuestionnaire, type Axis, type Question } from '../lib/questionnaire'
import { useLang, useT } from '../i18n/i18n'
import AppNav from '../components/AppNav'
import AdminNav from '../components/AdminNav'

const textInput =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-soft outline-none transition-shadow placeholder:text-muted focus:ring-2 focus:ring-teal/40'
const fieldLabel = 'mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted'
const pickL = (lang: 'en' | 'es', en: string, es: string) => (lang === 'es' ? es : en)

type Draft = {
  id: string
  promptEn: string
  promptEs: string
  axis: Axis
  direction: 1 | -1
}

function toDraft(q: Question): Draft {
  return { id: q.id, promptEn: q.prompt.en, promptEs: q.prompt.es, axis: q.axis, direction: q.direction }
}

export default function AdminQuestionsPage() {
  const t = useT()
  const { lang } = useLang()
  const { questions, addQuestion, removeQuestion, updateQuestion, moveQuestion, reset } =
    useQuestionnaire()

  const [drafts, setDrafts] = useState<Draft[]>(() => questions.map(toDraft))
  // Reconcile per question, not wholesale. Reordering, adding or deleting
  // persists immediately and hands back a new array — which, re-seeded blindly,
  // discarded a Spanish prompt the admin had retyped but not yet saved.
  const persistedRef = useRef(new Map<string, string>())
  useEffect(() => {
    setDrafts((prev) => {
      const byId = new Map(prev.map((d) => [d.id, d]))
      return questions.map((q) => {
        const fresh = toDraft(q)
        const key = JSON.stringify(fresh)
        const lastSeen = persistedRef.current.get(q.id)
        persistedRef.current.set(q.id, key)
        const existing = byId.get(q.id)
        if (!existing || lastSeen === undefined || lastSeen !== key) return fresh
        return existing
      })
    })
  }, [questions])

  const patch = (id: string, p: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d)))

  const axisLabel = (axis: Axis) => (axis === 'riskAversion' ? t.axes.riskAversion : t.axes.liquidity)

  const save = (d: Draft) =>
    updateQuestion(d.id, {
      prompt: { en: d.promptEn.trim(), es: d.promptEs.trim() },
      axis: d.axis,
      direction: d.direction,
    })

  const onDelete = (d: Draft) => {
    if (questions.length <= 1) return
    if (window.confirm(pickL(lang, 'Delete this question?', '¿Eliminar esta pregunta?')))
      removeQuestion(d.id)
  }
  const handleReset = () => {
    if (window.confirm(t.adminQuestions.resetConfirm)) reset()
  }

  // Balance hint: how many questions feed each axis.
  const perAxis = (axis: Axis) => questions.filter((q) => q.axis === axis).length

  return (
    <div>
      <AppNav />
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <AdminNav />

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text">
              {t.adminQuestions.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {t.adminQuestions.intro}
            </p>
            <p className="mt-2 font-mono text-xs text-muted">
              {t.axes.riskAversion}: {perAxis('riskAversion')} · {t.axes.liquidity}:{' '}
              {perAxis('liquidity')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-red"
          >
            {t.adminQuestions.resetDefaults}
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-onAccent shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
          >
            + {t.adminQuestions.add}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {drafts.map((d, i) => (
            <div key={d.id} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted tnum">{i + 1}</span>
                <span className="flex-1" />
                <button
                  type="button"
                  aria-label={t.adminQuestions.moveUp}
                  onClick={() => moveQuestion(d.id, -1)}
                  disabled={i === 0}
                  className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-text disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={t.adminQuestions.moveDown}
                  onClick={() => moveQuestion(d.id, 1)}
                  disabled={i === drafts.length - 1}
                  className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-text disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(d)}
                  disabled={questions.length <= 1}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted/70 transition-colors hover:bg-red/10 hover:text-red disabled:opacity-30"
                >
                  {pickL(lang, 'Delete', 'Eliminar')}
                </button>
              </div>

              <div className="mt-3">
                <label className={fieldLabel}>{t.adminQuestions.promptLabel}</label>
                <textarea rows={2} className={textInput} value={d.promptEn} placeholder="EN" onChange={(e) => patch(d.id, { promptEn: e.target.value })} />
                <textarea rows={2} className={`${textInput} mt-2`} value={d.promptEs} placeholder="ES" onChange={(e) => patch(d.id, { promptEs: e.target.value })} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={fieldLabel}>{t.adminQuestions.axisLabel}</label>
                  <select
                    className={textInput}
                    value={d.axis}
                    onChange={(e) => patch(d.id, { axis: e.target.value as Axis })}
                  >
                    {AXES.map((ax) => (
                      <option key={ax} value={ax}>
                        {axisLabel(ax)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>{t.adminQuestions.directionLabel}</label>
                  <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
                    {([1, -1] as const).map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => patch(d.id, { direction: dir })}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          d.direction === dir ? 'bg-teal/15 text-teal shadow-soft' : 'text-muted hover:text-text'
                        }`}
                      >
                        {dir === 1 ? t.adminQuestions.dirMore : t.adminQuestions.dirLess}{' '}
                        {axisLabel(d.axis)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-hairline pt-4">
                <button
                  type="button"
                  onClick={() => save(d)}
                  className="rounded-xl bg-teal px-5 py-2 text-sm font-semibold text-onAccent shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
                >
                  {t.adminQuestions.save}
                </button>
              </div>
            </div>
          ))}

          {drafts.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-soft">
              <p className="text-sm text-muted">{t.adminQuestions.empty}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
