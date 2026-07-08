import type { Lang } from '../i18n/i18n'

// ---------------------------------------------------------------------------
// Interpretation labels for the advisor panel (en/es)
// ---------------------------------------------------------------------------

type FiveBands = [string, string, string, string, string]

// Band boundaries shared by every axis: <-0.6, <-0.2, <0.2, <0.6, else.
function band(v: number, labels: FiveBands): string {
  if (v < -0.6) return labels[0]
  if (v < -0.2) return labels[1]
  if (v < 0.2) return labels[2]
  if (v < 0.6) return labels[3]
  return labels[4]
}

const SIGMA_LABELS: Record<Lang, FiveBands> = {
  en: [
    'strongly variance-averse',
    'mildly variance-averse',
    'approximately variance-neutral',
    'mildly variance-tolerant',
    'strongly variance-tolerant',
  ],
  es: [
    'fuertemente averso a la varianza',
    'levemente averso a la varianza',
    'aproximadamente neutral a la varianza',
    'levemente tolerante a la varianza',
    'fuertemente tolerante a la varianza',
  ],
}

const ALPHA_LABELS: Record<Lang, FiveBands> = {
  en: [
    'strong negative-skew preference (carry-oriented)',
    'mild negative-skew preference',
    'no strong skew preference',
    'mild positive-skew preference',
    'strong positive-skew preference (lottery-oriented)',
  ],
  es: [
    'fuerte preferencia por asimetría negativa (orientado al carry)',
    'leve preferencia por asimetría negativa',
    'sin preferencia clara de asimetría',
    'leve preferencia por asimetría positiva',
    'fuerte preferencia por asimetría positiva (orientado a lotería)',
  ],
}

const LOSS_LABELS: Record<Lang, FiveBands> = {
  en: [
    'strongly loss-averse',
    'mildly loss-averse',
    'approximately loss-neutral',
    'mildly loss-tolerant',
    'strongly loss-tolerant',
  ],
  es: [
    'fuertemente averso a pérdidas',
    'levemente averso a pérdidas',
    'aproximadamente neutral a pérdidas',
    'levemente tolerante a pérdidas',
    'fuertemente tolerante a pérdidas',
  ],
}

const EV_LABELS: Record<Lang, FiveBands> = {
  en: [
    'comfort-driven — sacrifices expected return for a preferred payoff shape',
    'mildly comfort-driven',
    'balanced between expected value and payoff shape',
    'mildly EV-driven',
    'strongly EV-driven — takes the richer side regardless of shape',
  ],
  es: [
    'guiado por comodidad — sacrifica rendimiento esperado por una forma de pago preferida',
    'levemente guiado por comodidad',
    'equilibrado entre valor esperado y forma de pago',
    'levemente guiado por VE',
    'fuertemente guiado por VE — toma el lado más rentable sin importar la forma',
  ],
}

export function getSigmaLabel(v: number, lang: Lang): string {
  return band(v, SIGMA_LABELS[lang])
}

export function getAlphaLabel(v: number, lang: Lang): string {
  return band(v, ALPHA_LABELS[lang])
}

// Takes LOSS TOLERANCE (= −λ), so polarity matches the other risk axes:
// positive = risk-on (loss-tolerant), negative = risk-off (loss-averse).
export function getLossToleranceLabel(v: number, lang: Lang): string {
  return band(v, LOSS_LABELS[lang])
}

export function getEvLabel(v: number, lang: Lang): string {
  return band(v, EV_LABELS[lang])
}

// ---------------------------------------------------------------------------
// Advisor talking points — 2-4 bullets per archetype (en/es)
// ---------------------------------------------------------------------------

const TALKING_POINTS: Record<Lang, Record<string, { always: string[]; evHigh?: string; evLow?: string }>> = {
  en: {
    banker: {
      always: [
        'Lead with capital protection — frame every recommendation downside first, upside second.',
        'Avoid products with gap risk or uncertain barriers even if the expected return is attractive.',
      ],
      evLow:
        'Willing to give up expected return for certainty — quantify the premium they are paying for protection so it is a conscious choice.',
    },
    quant: {
      always: [
        'Lead with expected value and fee efficiency — this client responds to data, not narrative.',
        'Avoid over-engineering — complexity will feel like a fee extraction mechanism.',
      ],
      evHigh:
        'Strongly EV-driven — show the math; they will accept an unfamiliar or uncomfortable shape if the expected value is clearly higher.',
    },
    venture: {
      always: [
        'Lead with the upside story — show the best-case scenario first.',
        'Consider a core/satellite structure: stable core with an explicitly labeled speculative sleeve.',
      ],
      evLow:
        'Pays up for positive skew — be explicit when a flashy product has a lower expected value than a plainer one.',
    },
    insurer: {
      always: [
        'Frame recommendations around income and yield — this client thinks in terms of premium, not appreciation.',
        'Be explicit about gap risk in autocallables and reverse convertibles — low loss aversion does not mean uninformed.',
      ],
      evHigh:
        'Comfortable accepting negative skew for a higher average — reliable premium structures land well.',
    },
    indexer: {
      always: [
        'Lead with simplicity and transparency — product complexity creates friction and reduces trust.',
        'Build around well-known benchmarks the client can track independently.',
      ],
    },
  },
  es: {
    banker: {
      always: [
        'Empieza por la protección del capital — presenta cada recomendación primero por el riesgo a la baja y después por el potencial.',
        'Evita productos con riesgo de gap o barreras inciertas aunque el rendimiento esperado sea atractivo.',
      ],
      evLow:
        'Dispuesto a ceder rendimiento esperado por certeza — cuantifica la prima que paga por protección para que sea una elección consciente.',
    },
    quant: {
      always: [
        'Empieza por el valor esperado y la eficiencia en comisiones — este cliente responde a datos, no a narrativa.',
        'Evita la sobreingeniería — la complejidad se percibirá como un mecanismo para extraer comisiones.',
      ],
      evHigh:
        'Fuertemente guiado por VE — muestra la matemática; aceptará una forma desconocida o incómoda si el valor esperado es claramente mayor.',
    },
    venture: {
      always: [
        'Empieza por la historia de crecimiento — muestra primero el mejor escenario.',
        'Considera una estructura núcleo/satélite: un núcleo estable con una porción especulativa explícitamente identificada.',
      ],
      evLow:
        'Paga de más por asimetría positiva — sé explícito cuando un producto llamativo tiene menor valor esperado que uno más simple.',
    },
    insurer: {
      always: [
        'Enmarca las recomendaciones en ingresos y rendimiento — este cliente piensa en primas, no en apreciación.',
        'Sé explícito sobre el riesgo de gap en autocallables y reverse convertibles — baja aversión a pérdidas no significa desinformado.',
      ],
      evHigh:
        'Cómodo aceptando asimetría negativa por un promedio mayor — las estructuras de prima confiable encajan bien.',
    },
    indexer: {
      always: [
        'Empieza por la simplicidad y la transparencia — la complejidad genera fricción y reduce la confianza.',
        'Construye alrededor de índices conocidos que el cliente pueda seguir por su cuenta.',
      ],
    },
  },
}

export function getTalkingPoints(
  archetype: string,
  scores: { ev: number },
  lang: Lang,
): string[] {
  const entry = TALKING_POINTS[lang][archetype]
  if (!entry) return []
  const points = [...entry.always]
  if (scores.ev > 0.3 && entry.evHigh) points.push(entry.evHigh)
  if (scores.ev < -0.3 && entry.evLow) points.push(entry.evLow)
  return points
}
