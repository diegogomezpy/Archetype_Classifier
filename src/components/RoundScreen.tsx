import type { Round } from '../types'
import RoundDecision from './RoundDecision'

type Props = {
  round: Round
  index: number // 1-based round number
  total: number
  runningPnl: number
  onNext: (allocX: number, drawDelta: number) => void
}

// Every round is now an allocation decision (the binary liquidity rounds were
// removed when the test moved to a pure risk-shape + EV-discipline design).
export default function RoundScreen({ round, index, total, runningPnl, onNext }: Props) {
  return (
    <RoundDecision
      round={round}
      index={index}
      total={total}
      runningPnl={runningPnl}
      onNext={onNext}
    />
  )
}
