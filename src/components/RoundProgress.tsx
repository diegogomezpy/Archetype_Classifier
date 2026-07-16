import { useT } from '../i18n/i18n'

type Props = {
  index: number // 1-based current round
  total: number
}

// Segmented progress indicator — one small bar per round, filled up to the
// current round. Replaces the bare "3 / 16" counter so progress reads as a
// shrinking distance rather than a number to keep track of.
export default function RoundProgress({ index, total }: Props) {
  const t = useT()
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-3 rounded-full transition-colors duration-300 ${
              i < index ? 'bg-teal' : 'bg-border'
            }`}
          />
        ))}
      </div>
      <span className="tnum text-muted" aria-label={t.round.roundOf(index, total)}>
        {index} / {total}
      </span>
    </div>
  )
}
