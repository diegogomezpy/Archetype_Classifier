import { useState } from 'react'
import IntroScreen from '../components/IntroScreen'
import RoundScreen from '../components/RoundScreen'
import HalfwayScreen from '../components/HalfwayScreen'
import ClientResult from '../components/ClientResult'
import { ROUNDS } from '../data/rounds'
import {
  EMPTY_SCORES,
  applyScore,
  buildDashboardData,
  normalizeScores,
  type Answer,
  type DashboardData,
} from '../lib/scoring'
import { getSessionStore } from '../lib/storage'
import type { Scores } from '../types'

type FlowState = 'intro' | 'playing' | 'interstitial' | 'result'

// Index of the first round on screen 2 (round 6). Crossing it triggers the
// halfway interstitial.
const SCREEN2_START = ROUNDS.findIndex((r) => r.screen === 2)

// The client-facing test flow: intro → rounds (with halfway break) → the
// client's own profile. The advisor dashboard is NOT shown here — a completed
// test is saved as a session and reviewed on the #/advisor route.
export default function TestFlowPage() {
  const [state, setState] = useState<FlowState>('intro')
  const [clientLabel, setClientLabel] = useState<string | null>(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [rawScores, setRawScores] = useState<Scores>(EMPTY_SCORES)
  // Per-round (round, allocX) answers — needed to derive λ from realized downside.
  const [answers, setAnswers] = useState<Answer[]>([])
  const [totalPnl, setTotalPnl] = useState(0) // cumulative drawn P&L across rounds
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

  const total = ROUNDS.length

  const progress =
    state === 'intro' ? 0 : state === 'result' ? 100 : (roundIndex / total) * 100

  const start = (label: string | null) => {
    setClientLabel(label)
    setRawScores(EMPTY_SCORES)
    setAnswers([])
    setTotalPnl(0)
    setRoundIndex(0)
    setDashboardData(null)
    setState('playing')
  }

  // Called after the player has seen the round's draw reveal. `drawDelta` is the
  // sampled P&L for the round, accumulated into the running total.
  const handleNext = (allocX: number, drawDelta: number) => {
    const round = ROUNDS[roundIndex]
    const nextRaw = applyScore(rawScores, round, allocX)
    const nextAnswers = [...answers, { round, allocX }]
    setRawScores(nextRaw)
    setAnswers(nextAnswers)
    setTotalPnl((t) => t + drawDelta)

    const nextIndex = roundIndex + 1

    if (nextIndex >= total) {
      // Final round complete — compute everything synchronously, persist the
      // session for the advisor, and show the client their profile. The drawn
      // game P&L is NOT saved — it's engagement-only, not profile data.
      const data = buildDashboardData(normalizeScores(nextRaw), nextAnswers)
      setDashboardData(data)
      setState('result')
      getSessionStore()
        .saveSession({
          ...data,
          clientLabel,
          answers: nextAnswers.map((a) => ({ roundId: a.round.id, allocX: a.allocX })),
        })
        .catch((err) => console.warn('Failed to save session:', err))
    } else if (nextIndex === SCREEN2_START) {
      // Crossing from screen 1 into screen 2 — show the halfway moment first.
      setRoundIndex(nextIndex)
      setState('interstitial')
    } else {
      setRoundIndex(nextIndex)
    }
  }

  const continueToScreen2 = () => setState('playing')

  const retake = () => {
    setClientLabel(null)
    setRawScores(EMPTY_SCORES)
    setAnswers([])
    setTotalPnl(0)
    setRoundIndex(0)
    setDashboardData(null)
    setState('intro')
  }

  return (
    <div className="relative min-h-[100svh] w-full">
      {/* Thin teal progress bar across the very top (spans all 10 rounds) */}
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-black/[0.06]">
        <div
          className="h-full bg-teal transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {state === 'intro' && <IntroScreen onStart={start} />}

      {state === 'playing' && (
        <RoundScreen
          key={ROUNDS[roundIndex].id}
          round={ROUNDS[roundIndex]}
          index={roundIndex + 1}
          total={total}
          runningPnl={totalPnl}
          onNext={handleNext}
        />
      )}

      {state === 'interstitial' && <HalfwayScreen onContinue={continueToScreen2} />}

      {state === 'result' && dashboardData && (
        <ClientResult data={dashboardData} onRetake={retake} />
      )}
    </div>
  )
}
