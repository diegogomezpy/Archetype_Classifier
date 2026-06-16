type Props = {
  capital: number // current balance ($10,000 + cumulative profit)
  pnl: number // cumulative profit
  draw: number | null // the live "This draw" figure during the animation, else null
  drawPulsing?: boolean // subtle flicker while the draw is still cycling
}

function fmtMoney(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US')
}

function fmtDelta(n: number): string {
  const r = Math.round(n)
  if (r === 0) return '$0'
  return (r > 0 ? '+$' : '−$') + Math.abs(r).toLocaleString('en-US')
}

function deltaColor(n: number): string {
  const r = Math.round(n)
  return r === 0 ? 'text-muted' : r > 0 ? 'text-teal' : 'text-red'
}

const label = 'font-mono text-[11px] uppercase tracking-[0.14em] text-muted'

// Prominent running tally shown above the payoff bar: current capital on the
// left, cumulative profit on the right, and the live draw figure between them
// while a round is being resolved.
export default function Scoreboard({ capital, pnl, draw, drawPulsing }: Props) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className={label}>Capital</div>
        <div className="font-mono text-3xl font-semibold tnum text-text">{fmtMoney(capital)}</div>
      </div>

      {draw !== null && (
        <div className={`text-center transition-opacity duration-100 ${drawPulsing ? 'opacity-70' : 'opacity-100'}`}>
          <div className={label}>This draw</div>
          <div className={`font-mono text-3xl font-semibold tnum ${deltaColor(draw)}`}>
            {fmtDelta(draw)}
          </div>
        </div>
      )}

      <div className="text-right">
        <div className={label}>Profit</div>
        <div className={`font-mono text-3xl font-semibold tnum ${deltaColor(pnl)}`}>
          {fmtDelta(pnl)}
        </div>
      </div>
    </div>
  )
}
