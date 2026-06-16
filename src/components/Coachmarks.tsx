import { useLayoutEffect, useState } from 'react'

const STORAGE_KEY = 'cadiem_tutorial_seen_v1'

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore (private mode, etc.) */
  }
}

type Step = { selector: string; title: string; body: string }

// Each step points at a real element on the round screen (tagged with a
// matching data-tour attribute in RoundDecision).
const STEPS: Step[] = [
  {
    selector: '[data-tour="bar"]',
    title: 'Read the outcome bar',
    body: 'This shows every possible result. Wider means more likely — green is a gain, red is a loss.',
  },
  {
    selector: '[data-tour="slider"]',
    title: 'Set your mix',
    body: 'Drag to split your $10,000 between the Growth and Steady sides. The bar updates as you move it.',
  },
  {
    selector: '[data-tour="next"]',
    title: 'Lock it in',
    body: 'Happy with the mix? Lock it in — we draw one real outcome from your odds and add it to your running total. Go with your gut.',
  },
]

const CARD_W = 312 // px — fixed so we can center/clamp against the target
const GAP = 14 // px — distance between the target and the card
const HALO = 8 // px — spotlight padding around the target
const EDGE = 12 // px — minimum viewport margin

type Box = { top: number; left: number; width: number; height: number }

type Props = {
  onClose: () => void
}

// One-time, in-context walkthrough shown on the first allocation round. Each
// step spotlights its target element and floats a tooltip with an arrow that
// points at it. Dismissal (finish or skip) is persisted.
export default function Coachmarks({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const [box, setBox] = useState<Box | null>(null)

  useLayoutEffect(() => {
    const el = document.querySelector(STEPS[step].selector)
    const measure = () => {
      if (!el) return
      const r = el.getBoundingClientRect()
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    // Bring the target on-screen before pointing at it (the Next button can
    // sit below the fold), then measure once the scroll settles.
    el?.scrollIntoView({ block: 'center', behavior: 'auto' })
    measure()
    const t = window.setTimeout(measure, 60)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step])

  const last = step === STEPS.length - 1
  const finish = () => {
    markSeen()
    onClose()
  }
  const next = () => (last ? finish() : setStep((s) => s + 1))

  if (!box) return null

  // Place the card below the target when there's room, otherwise above.
  const below = box.top + box.height + 220 < window.innerHeight
  const cardLeft = Math.min(
    Math.max(box.left + box.width / 2 - CARD_W / 2, EDGE),
    window.innerWidth - CARD_W - EDGE,
  )
  const cardTop = below ? box.top + box.height + GAP : box.top - GAP
  const arrowLeft = Math.min(Math.max(box.left + box.width / 2 - cardLeft, 20), CARD_W - 20)

  const { title, body } = STEPS[step]

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Spotlight — transparent box with a huge shadow that dims everything
          else, plus a teal ring around the target. */}
      <div
        className="pointer-events-none absolute rounded-xl ring-2 ring-teal transition-all duration-300"
        style={{
          top: box.top - HALO,
          left: box.left - HALO,
          width: box.width + HALO * 2,
          height: box.height + HALO * 2,
          boxShadow: '0 0 0 9999px rgba(20, 22, 28, 0.55)',
        }}
      />

      {/* Tooltip card, anchored to the target with a pointer arrow. */}
      <div
        className="animate-fade-slide-up absolute"
        style={{
          left: cardLeft,
          top: cardTop,
          width: CARD_W,
          transform: below ? undefined : 'translateY(-100%)',
        }}
      >
        {/* Arrow (above the card when placed below the target, and vice versa) */}
        <div
          className="absolute h-3 w-3 rotate-45 border-teal/40 bg-surface"
          style={
            below
              ? { top: -6, left: arrowLeft, borderTopWidth: 1, borderLeftWidth: 1 }
              : { bottom: -6, left: arrowLeft, borderBottomWidth: 1, borderRightWidth: 1 }
          }
        />

        <div className="relative rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-teal">
              How it works
            </span>
            <span className="font-mono text-xs text-muted tnum">
              {step + 1} / {STEPS.length}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-semibold tracking-tight text-text">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>

          {/* Step dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-5 bg-teal' : 'w-1.5 bg-surface2'
                }`}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={finish}
              className="text-sm font-medium text-muted transition-colors hover:text-text"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={next}
              className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0"
            >
              {last ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
