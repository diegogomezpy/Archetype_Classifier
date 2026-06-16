// ---------------------------------------------------------------------------
// Interpretation labels for the advisor panel
// ---------------------------------------------------------------------------

export function getSigmaLabel(v: number): string {
  if (v < -0.6) return 'strongly variance-averse'
  if (v < -0.2) return 'mildly variance-averse'
  if (v < 0.2) return 'approximately variance-neutral'
  if (v < 0.6) return 'mildly variance-tolerant'
  return 'strongly variance-tolerant'
}

export function getAlphaLabel(v: number): string {
  if (v < -0.6) return 'strong negative-skew preference (carry-oriented)'
  if (v < -0.2) return 'mild negative-skew preference'
  if (v < 0.2) return 'no strong skew preference'
  if (v < 0.6) return 'mild positive-skew preference'
  return 'strong positive-skew preference (lottery-oriented)'
}

export function getLambdaLabel(v: number): string {
  if (v < -0.6) return 'very low loss aversion'
  if (v < -0.2) return 'below-average loss aversion'
  if (v < 0.2) return 'moderate loss aversion'
  if (v < 0.6) return 'above-average loss aversion'
  return 'high loss aversion'
}

export function getLiqLabel(v: number): string {
  if (v < 0.3) return 'low — illiquidity-tolerant, lockups appropriate'
  if (v < 0.6) return 'moderate — standard liquid product mix'
  return 'high — avoid lockups, prioritize exit flexibility'
}

/** Split an accessory label "head — implication" into its level and product implication. */
export function splitLabel(label: string): { level: 'low' | 'moderate' | 'high'; implication: string } {
  const [head, ...rest] = label.split(' — ')
  const level = head.trim().toLowerCase() as 'low' | 'moderate' | 'high'
  return { level, implication: rest.join(' — ') }
}

// ---------------------------------------------------------------------------
// Advisor talking points — 2-4 bullets per archetype
// ---------------------------------------------------------------------------

export function getTalkingPoints(
  archetype: string,
  scores: { liq: number },
): string[] {
  const liqHigh = scores.liq > 0.3
  const liqLow = scores.liq < -0.3

  const points: Record<string, (string | null)[]> = {
    protector: [
      'Lead with capital protection — frame every recommendation downside first, upside second.',
      'Avoid products with gap risk or uncertain barriers even if the expected return is attractive.',
      liqHigh ? 'Liquidity is important — avoid lockups even at meaningfully higher returns.' : null,
    ],
    optimizer: [
      'Lead with expected value and fee efficiency — this client responds to data, not narrative.',
      'Avoid over-engineering — complexity will feel like a fee extraction mechanism.',
      liqLow
        ? 'Liquidity-tolerant — longer-dated instruments and illiquidity premia are appropriate.'
        : null,
    ],
    lottery: [
      'Lead with the upside story — show the best-case scenario first.',
      'Consider a core/satellite structure: stable core with an explicitly labeled speculative sleeve.',
      liqLow
        ? 'High liquidity tolerance — private market exposure or long-dated options viable for the satellite.'
        : null,
    ],
    carry: [
      'Frame recommendations around income and yield — this client thinks in terms of premium, not appreciation.',
      'Be explicit about gap risk in autocallables and reverse convertibles — low loss aversion does not mean uninformed.',
      liqHigh
        ? 'Liquidity preference — covered-call ETFs may suit better than illiquid OTC structures.'
        : null,
    ],
    agnostic: [
      'Lead with simplicity and transparency — product complexity creates friction and reduces trust.',
      'Build around well-known benchmarks the client can track independently.',
      liqHigh
        ? 'Liquidity is a priority — keep the portfolio fully liquid even at modest return cost.'
        : null,
    ],
  }

  return (points[archetype] ?? []).filter((p): p is string => p !== null)
}
