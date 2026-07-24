import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AxisScores } from './scoring'
import { api } from './api'

// ---------------------------------------------------------------------------
// The admin-authored questionnaire
// ---------------------------------------------------------------------------
// The whole client measurement is a set of statements the admin writes. A client
// rates each on a 5-point agree/disagree scale. Each statement feeds exactly one
// axis, and a direction says whether agreeing pushes that axis up or down. The
// client's position on an axis is the average of that axis's answers.

export type Axis = 'riskAversion' | 'liquidity'
export const AXES: Axis[] = ['riskAversion', 'liquidity']

export type Question = {
  id: string
  prompt: { en: string; es: string }
  axis: Axis
  // +1: agreeing raises the axis · −1: agreeing lowers it.
  direction: 1 | -1
}

export type QuestionnaireConfig = { questions: Question[] }

// The 5-point Likert scale, mapped to a symmetric numeric value.
export const LIKERT_VALUES = [-2, -1, 0, 1, 2] as const
export type LikertValue = (typeof LIKERT_VALUES)[number]

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// Config version — bumped whenever the persisted shape changes, so a stale doc is
// reseeded rather than half-read.
const CONFIG_VERSION = 1

// ── Scoring ────────────────────────────────────────────────────────────────
// Each axis score = mean over that axis's answered questions of
// (answer × direction) / 2, clamped to [-1, 1]. Unanswered questions drop out;
// an axis with no answers scores 0 (neutral).
export function scoreAnswers(
  answers: Record<string, number>,
  questions: Question[],
): AxisScores {
  const acc: Record<Axis, { sum: number; n: number }> = {
    riskAversion: { sum: 0, n: 0 },
    liquidity: { sum: 0, n: 0 },
  }
  for (const q of questions) {
    const a = answers[q.id]
    if (a == null || Number.isNaN(a)) continue
    acc[q.axis].sum += (a * q.direction) / 2
    acc[q.axis].n += 1
  }
  return {
    riskAversion: acc.riskAversion.n ? clamp(acc.riskAversion.sum / acc.riskAversion.n, -1, 1) : 0,
    liquidity: acc.liquidity.n ? clamp(acc.liquidity.sum / acc.liquidity.n, -1, 1) : 0,
  }
}

// ── Seeding ────────────────────────────────────────────────────────────────
// A balanced starter set: four statements per axis, mixing directions so a
// straight-line answerer lands near neutral rather than at an extreme.
export function seedQuestions(): Question[] {
  const q = (
    id: string,
    axis: Axis,
    direction: 1 | -1,
    en: string,
    es: string,
  ): Question => ({ id, axis, direction, prompt: { en, es } })
  return [
    // Risk aversion — agree = more averse unless direction is −1.
    q(
      'q-risk-1',
      'riskAversion',
      1,
      'I would sell an investment right away if it dropped 10% in a month.',
      'Vendería una inversión enseguida si cayera 10% en un mes.',
    ),
    q(
      'q-risk-2',
      'riskAversion',
      1,
      'A steady, predictable return matters more to me than the chance of a big gain.',
      'Un rendimiento estable y predecible me importa más que la chance de una gran ganancia.',
    ),
    q(
      'q-risk-3',
      'riskAversion',
      -1,
      'I am comfortable watching my portfolio swing up and down for higher long-term returns.',
      'Me siento cómodo viendo mi cartera subir y bajar a cambio de mayores retornos a largo plazo.',
    ),
    q(
      'q-risk-4',
      'riskAversion',
      1,
      'Losing money worries me more than missing out on gains.',
      'Perder dinero me preocupa más que perderme ganancias.',
    ),
    // Liquidity preference — agree = wants more liquidity unless direction is −1.
    q(
      'q-liq-1',
      'liquidity',
      1,
      'I need to be able to access my money within a few weeks if something comes up.',
      'Necesito poder acceder a mi dinero en pocas semanas si surge algo.',
    ),
    q(
      'q-liq-2',
      'liquidity',
      -1,
      'I am fine locking up an investment for several years if it means better returns.',
      'No tengo problema en inmovilizar una inversión por varios años si eso significa mejores retornos.',
    ),
    q(
      'q-liq-3',
      'liquidity',
      1,
      'Keeping cash on hand for emergencies is a priority for me.',
      'Tener efectivo disponible para emergencias es una prioridad para mí.',
    ),
    q(
      'q-liq-4',
      'liquidity',
      -1,
      'I rarely expect to need this money on short notice.',
      'Rara vez espero necesitar este dinero de un momento a otro.',
    ),
  ]
}

export function seedConfig(): QuestionnaireConfig {
  return { questions: seedQuestions() }
}

// A blank question for the "+ Add" action. Defaults to the risk axis.
let addCounter = 0
export function blankQuestion(): Question {
  addCounter += 1
  return {
    id: `q-${Date.now().toString(36)}-${addCounter}`,
    prompt: { en: '', es: '' },
    axis: 'riskAversion',
    direction: 1,
  }
}

// Bring any stored doc onto the current shape; anything unrecognised reseeds.
export function mergeWithSeed(raw: unknown): QuestionnaireConfig {
  const partial = (raw ?? {}) as { version?: number; questions?: unknown }
  const arr = Array.isArray(partial.questions) ? (partial.questions as Question[]) : null
  const looksValid =
    partial.version === CONFIG_VERSION &&
    arr != null &&
    arr.every(
      (q) =>
        q &&
        typeof q.id === 'string' &&
        q.prompt &&
        (q.axis === 'riskAversion' || q.axis === 'liquidity') &&
        (q.direction === 1 || q.direction === -1),
    )
  if (looksValid && arr) {
    const questions = arr.map((q) => ({
      id: q.id,
      prompt: { en: q.prompt.en ?? '', es: q.prompt.es ?? '' },
      axis: q.axis,
      direction: q.direction,
    }))
    return { questions }
  }
  return seedConfig()
}

// ── React context (backend-API backed) ──────────────────────────────────────

type QuestionnaireContextValue = {
  questions: Question[]
  addQuestion: () => void
  removeQuestion: (id: string) => void
  updateQuestion: (id: string, patch: Partial<Question>) => void
  moveQuestion: (id: string, dir: -1 | 1) => void
  reset: () => void
}

const QuestionnaireContext = createContext<QuestionnaireContextValue>({
  questions: seedQuestions(),
  addQuestion: () => {},
  removeQuestion: () => {},
  updateQuestion: () => {},
  moveQuestion: () => {},
  reset: () => {},
})

export function QuestionnaireProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<QuestionnaireConfig>(() => seedConfig())

  const persist = (next: QuestionnaireConfig) => {
    setConfig(next)
    void api
      .put('/config/questions', { version: CONFIG_VERSION, questions: next.questions })
      .catch((e) => console.warn('questions save:', e))
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const loaded = await api.get<unknown>('/config/questions')
        if (!loaded) {
          const seed = seedConfig()
          await api.put('/config/questions', { version: CONFIG_VERSION, questions: seed.questions })
          if (alive) setConfig(seed)
        } else {
          const merged = mergeWithSeed(loaded)
          if (alive) setConfig(merged)
          // Overwrite a stale/legacy doc so the store converges on the new shape.
          if ((loaded as { version?: number })?.version !== CONFIG_VERSION) {
            void api
              .put('/config/questions', { version: CONFIG_VERSION, questions: merged.questions })
              .catch(() => {})
          }
        }
      } catch {
        // Backend unreachable — keep the seeded defaults.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<QuestionnaireContextValue>(() => {
    const replace = (questions: Question[]) => persist({ questions })
    return {
      questions: config.questions,
      addQuestion: () => replace([...config.questions, blankQuestion()]),
      removeQuestion: (id) => replace(config.questions.filter((q) => q.id !== id)),
      updateQuestion: (id, patch) =>
        replace(config.questions.map((q) => (q.id === id ? { ...q, ...patch } : q))),
      moveQuestion: (id, dir) => {
        const list = config.questions.slice()
        const i = list.findIndex((q) => q.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= list.length) return
        ;[list[i], list[j]] = [list[j], list[i]]
        replace(list)
      },
      reset: () => persist(seedConfig()),
    }
  }, [config])

  return createElement(QuestionnaireContext.Provider, { value }, children)
}

export function useQuestionnaire(): QuestionnaireContextValue {
  return useContext(QuestionnaireContext)
}
