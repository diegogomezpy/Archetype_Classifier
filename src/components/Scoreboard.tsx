import { useT } from '../i18n/i18n'

type Props = {
  capital: number // current balance ($10,000 + cumulative profit)
  pnl: number // cumulative profit
  draw: number | null // the live "This draw" figure during the animation, else null
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

// Running tally above the payoff bar. Capital is the headline (your balance);
// profit rides underneath as a smaller signed sub-line. The live draw figure
// appears on the right while a round is being resolved.
export default function Scoreboard({ capital, pnl, draw }: Props) {
  const t = useT()
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className={label}>{t.scoreboard.capital}</div>
        <div className="font-mono text-3xl font-semibold tnum text-text">{fmtMoney(capital)}</div>
        <div className={`mt-0.5 font-mono text-sm font-medium tnum ${deltaColor(pnl)}`}>
          {fmtDelta(pnl)} {t.scoreboard.profitSuffix}
        </div>
      </div>

      {draw !== null && (
        <div className="text-right">
          <div className={label}>{t.scoreboard.thisDraw}</div>
          <div className={`font-mono text-3xl font-semibold tnum ${deltaColor(draw)}`}>
            {fmtDelta(draw)}
          </div>
        </div>
      )}
    </div>
  )
}
