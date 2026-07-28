import { useState } from 'react'
import IntroScreen, { type StartInfo } from '../components/IntroScreen'
import AppNav from '../components/AppNav'
import LanguageToggle from '../components/LanguageToggle'
import ThemeToggle from '../components/ThemeToggle'
import QuestionnaireScreen from '../components/QuestionnaireScreen'
import ClientResult from '../components/ClientResult'
import { reclassifyScores, type DashboardData } from '../lib/scoring'
import { scoreAnswers, useQuestionnaire, type LikertValue } from '../lib/questionnaire'
import { getSessionStore } from '../lib/storage'
import { useDirectory } from '../lib/directory'

type FlowState = 'intro' | 'questions' | 'result'

// The client-facing flow: intro → questionnaire → the client's own profile. The
// advisor portfolio is NOT shown here — a completed questionnaire is saved as a
// session and reviewed on the #/advisor route.
export default function TestFlowPage() {
  const { rememberClient } = useDirectory()
  const { questions } = useQuestionnaire()
  const [state, setState] = useState<FlowState>('intro')
  const [clientLabel, setClientLabel] = useState<string | null>(null)
  const [advisorId, setAdvisorId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

  const answered = questions.filter((q) => answers[q.id] != null).length
  const progress =
    state === 'intro' ? 0 : state === 'result' ? 100 : questions.length ? (answered / questions.length) * 100 : 0

  const start = (info: StartInfo) => {
    setClientLabel(info.name)
    setAdvisorId(info.advisorId)
    setAnswers({})
    setDashboardData(null)
    setState('questions')
  }

  const answer = (id: string, value: LikertValue) => setAnswers((a) => ({ ...a, [id]: value }))

  const submit = () => {
    // Score the answers → two axes → risk band, persist for the advisor, and show
    // the client their profile.
    const scores = scoreAnswers(answers, questions)
    const data = reclassifyScores(scores)
    setDashboardData(data)
    setState('result')

    getSessionStore()
      .submitSession({
        ...data,
        advisorId,
        clientName: clientLabel,
        answers: questions.map((q) => ({ questionId: q.id, value: answers[q.id] ?? 0 })),
      })
      .then((record) => {
        if (record.advisorId && record.clientId) {
          rememberClient({
            advisorId: record.advisorId,
            clientId: record.clientId,
            name: record.clientLabel ?? clientLabel ?? '',
          })
        }
      })
      .catch((err) => console.warn('Failed to save session:', err))
  }

  const retake = () => {
    setClientLabel(null)
    setAdvisorId(null)
    setAnswers({})
    setDashboardData(null)
    setState('intro')
  }

  return (
    <div className="relative min-h-[100svh] w-full">
      {/* Thin teal progress bar across the very top */}
      {/* bg-border, not a black wash — a 6% black track composites to ~1:1 on
          the dark ground and the progress bar had no visible rail at all. */}
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-border">
        <div
          className="h-full bg-teal transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {state === 'intro' && (
        <>
          <AppNav />
          <IntroScreen onStart={start} />
        </>
      )}

      {state === 'questions' && (
        <QuestionnaireScreen
          questions={questions}
          answers={answers}
          onAnswer={answer}
          onSubmit={submit}
        />
      )}

      {state === 'result' && dashboardData && (
        <ClientResult data={dashboardData} onRetake={retake} />
      )}

      {/* Language + theme live in the masthead everywhere else, but this flow
          hides it — float them so the client keeps both controls. */}
      {state !== 'intro' && (
        <>
          <LanguageToggle />
          <ThemeToggle />
        </>
      )}
    </div>
  )
}
