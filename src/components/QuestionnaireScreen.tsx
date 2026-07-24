import { useLang, useT } from '../i18n/i18n'
import { type LikertValue, type Question } from '../lib/questionnaire'

type Props = {
  questions: Question[]
  answers: Record<string, number>
  onAnswer: (id: string, value: LikertValue) => void
  onSubmit: () => void
}

// The client's measurement: a scrollable list of statements, each rated on a
// 5-point agree/disagree scale. Replaces the old allocation game. Submit unlocks
// once every statement is answered.
export default function QuestionnaireScreen({ questions, answers, onAnswer, onSubmit }: Props) {
  const t = useT()
  const { lang } = useLang()

  const scale: { value: LikertValue; label: string }[] = [
    { value: -2, label: t.questionnaire.scale.stronglyDisagree },
    { value: -1, label: t.questionnaire.scale.disagree },
    { value: 0, label: t.questionnaire.scale.neutral },
    { value: 1, label: t.questionnaire.scale.agree },
    { value: 2, label: t.questionnaire.scale.stronglyAgree },
  ]

  const answered = questions.filter((q) => answers[q.id] != null).length
  const complete = questions.length > 0 && answered === questions.length

  if (questions.length === 0) {
    return (
      <div className="flex min-h-[100svh] w-full items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-base font-medium text-text">{t.questionnaire.empty}</p>
          <p className="mt-2 text-sm text-muted">{t.questionnaire.emptyAdmin}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-40 pt-14">
      <div className="animate-fade-slide-up">
        <p className="mb-2 text-center font-mono text-xs uppercase tracking-[0.22em] text-teal">
          {t.questionnaire.eyebrow}
        </p>
        <h1 className="text-center text-3xl font-semibold tracking-tight text-text">
          {t.questionnaire.title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-muted">
          {t.questionnaire.subtitle}
        </p>
      </div>

      <ol className="mt-10 space-y-4">
        {questions.map((q, i) => {
          const current = answers[q.id]
          return (
            <li
              key={q.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6"
            >
              <div className="flex gap-3">
                <span className="mt-0.5 font-mono text-xs tabular-nums text-muted">{i + 1}</span>
                <p className="flex-1 text-[15px] font-medium leading-snug text-text">
                  {q.prompt[lang]}
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label={q.prompt[lang]}
                className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2"
              >
                {scale.map((s) => {
                  const active = current === s.value
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onAnswer(q.id, s.value)}
                      className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center transition-all duration-150 ${
                        active
                          ? 'border-teal/50 bg-teal/12 text-teal shadow-soft'
                          : 'border-border bg-surface text-muted hover:border-teal/30 hover:text-text'
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full border-2 ${
                          active ? 'border-teal bg-teal' : 'border-borderStrong'
                        }`}
                      />
                      <span className="text-[10px] font-medium leading-tight sm:text-[11px]">
                        {s.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Sticky submit bar with a live progress read-out. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-4">
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-teal transition-[width] duration-300 ease-out"
                style={{ width: `${(answered / questions.length) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 font-mono text-xs text-muted tnum">
              {t.questionnaire.progress(answered, questions.length)}
            </p>
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!complete}
            className="shrink-0 rounded-2xl bg-teal px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {t.questionnaire.submit}
          </button>
        </div>
      </div>
    </div>
  )
}
