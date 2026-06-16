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

export function getEvLabel(v: number): string {
  if (v < -0.6) return 'comfort-driven — sacrifices expected return for a preferred payoff shape'
  if (v < -0.2) return 'mildly comfort-driven'
  if (v < 0.2) return 'balanced between expected value and payoff shape'
  if (v < 0.6) return 'mildly EV-driven'
  return 'strongly EV-driven — takes the richer side regardless of shape'
}

// ---------------------------------------------------------------------------
// Advisor talking points — 2-4 bullets per archetype
// ---------------------------------------------------------------------------

export function getTalkingPoints(
  archetype: string,
  scores: { ev: number },
): string[] {
  const evHigh = scores.ev > 0.3 // chases expected value
  const evLow = scores.ev < -0.3 // sacrifices EV for a preferred shape

  const points: Record<string, (string | null)[]> = {
    banker: [
      'Lead with capital protection — frame every recommendation downside first, upside second.',
      'Avoid products with gap risk or uncertain barriers even if the expected return is attractive.',
      evLow
        ? 'Willing to give up expected return for certainty — quantify the premium they are paying for protection so it is a conscious choice.'
        : null,
    ],
    quant: [
      'Lead with expected value and fee efficiency — this client responds to data, not narrative.',
      'Avoid over-engineering — complexity will feel like a fee extraction mechanism.',
      evHigh
        ? 'Strongly EV-driven — show the math; they will accept an unfamiliar or uncomfortable shape if the expected value is clearly higher.'
        : null,
    ],
    venture: [
      'Lead with the upside story — show the best-case scenario first.',
      'Consider a core/satellite structure: stable core with an explicitly labeled speculative sleeve.',
      evLow
        ? 'Pays up for positive skew — be explicit when a flashy product has a lower expected value than a plainer one.'
        : null,
    ],
    insurer: [
      'Frame recommendations around income and yield — this client thinks in terms of premium, not appreciation.',
      'Be explicit about gap risk in autocallables and reverse convertibles — low loss aversion does not mean uninformed.',
      evHigh
        ? 'Comfortable accepting negative skew for a higher average — reliable premium structures land well.'
        : null,
    ],
    indexer: [
      'Lead with simplicity and transparency — product complexity creates friction and reduces trust.',
      'Build around well-known benchmarks the client can track independently.',
      null,
    ],
  }

  return (points[archetype] ?? []).filter((p): p is string => p !== null)
}
