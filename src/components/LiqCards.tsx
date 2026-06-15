import type { LiqOption } from '../types'
import Icon from './Icon'
import { money } from '../lib/format'

type Props = {
  x: LiqOption
  y: LiqOption
  selected: 'x' | 'y' | null
  onSelect: (side: 'x' | 'y') => void
}

function Card({
  option,
  side,
  selected,
  onSelect,
}: {
  option: LiqOption
  side: 'x' | 'y'
  selected: boolean
  onSelect: () => void
}) {
  const isX = side === 'x'

  const stateClass = selected
    ? isX
      ? 'border-teal/60 bg-teal/[0.06] shadow-card'
      : 'border-amber/60 bg-amber/[0.06] shadow-card'
    : 'border-border bg-surface shadow-soft hover:-translate-y-0.5 hover:shadow-card'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-1 flex-col items-start gap-4 rounded-2xl border p-7 text-left transition-all duration-200 ${stateClass}`}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          isX ? 'bg-teal/12 text-teal' : 'bg-amber/14 text-amber'
        }`}
      >
        <Icon name={option.icon} className="h-6 w-6" />
      </span>

      <span className="text-base font-medium text-text">{option.label}</span>

      <div className="flex items-baseline gap-2">
        <span className={`font-mono text-4xl font-medium tnum ${isX ? 'text-teal' : 'text-amber'}`}>
          {option.ret}
        </span>
        <span className="font-mono text-sm text-muted tnum">→ {money(option.ev)}</span>
      </div>

      <span className="text-sm leading-relaxed text-muted">{option.sub}</span>
    </button>
  )
}

export default function LiqCards({ x, y, selected, onSelect }: Props) {
  return (
    <div className="flex items-stretch gap-5">
      <Card option={x} side="x" selected={selected === 'x'} onSelect={() => onSelect('x')} />
      <Card option={y} side="y" selected={selected === 'y'} onSelect={() => onSelect('y')} />
    </div>
  )
}
