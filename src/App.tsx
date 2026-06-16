import { useState } from 'react'
import IntroScreen from './components/IntroScreen'
import RoundScreen from './components/RoundScreen'
import HalfwayScreen from './components/HalfwayScreen'
import AdvisorDashboard from './components/AdvisorDashboard'
import { ROUNDS } from './data/rounds'
import {
  EMPTY_SCORES,
  applyScore,
  buildDashboardData,
  normalizeScores,
  type DashboardData,
} from './lib/scoring'
import type { Scores } from './types'

type AppState = 'intro' | 'playing' | 'interstitial' | 'dashboard'

// Index of the first round on screen 2 (round 9). Crossing it triggers the
// halfway interstitial.
const SCREEN2_START = ROUNDS.findIndex((r) => r.screen === 2)

export default function App() {
  const [state, setState] = useState<AppState>('intro')
  const [roundIndex, setRoundIndex] = useState(0)
  const [rawScores, setRawScores] = useState<Scores>(EMPTY_SCORES)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

  const total = ROUNDS.length

  const progress =
    state === 'intro' ? 0 : state === 'dashboard' ? 100 : (roundIndex / total) * 100

  const start = () => {
    setRawScores(EMPTY_SCORES)
    setRoundIndex(0)
    setDashboardData(null)
    setState('playing')
  }

  const handleNext = (allocX: number) => {
    const round = ROUNDS[roundIndex]
    const nextRaw = applyScore(rawScores, round, allocX)
    setRawScores(nextRaw)

    const nextIndex = roundIndex + 1

    if (nextIndex >= total) {
      // Final round complete — compute everything synchronously and transition.
      const data = buildDashboardData(normalizeScores(nextRaw))
      setDashboardData(data)
      setState('dashboard')
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
    setRawScores(EMPTY_SCORES)
    setRoundIndex(0)
    setDashboardData(null)
    setState('intro')
  }

  return (
    <div className="relative min-h-[100svh] w-full bg-bg text-text">
      {/* Thin teal progress bar across the very top (spans all 13 rounds) */}
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
          onNext={handleNext}
        />
      )}

      {state === 'interstitial' && <HalfwayScreen onContinue={continueToScreen2} />}

      {state === 'dashboard' && dashboardData && (
        <AdvisorDashboard data={dashboardData} onRetake={retake} />
      )}
    </div>
  )
}
