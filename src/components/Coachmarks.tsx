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

// One step per element on the round screen (each tagged with a matching
// data-tour attribute in RoundDecision), walked through in reading order.
const STEPS: Step[] = [
  {
    selector: '[data-tour="capital"]',
    title: 'This is your money',
    body: 'You start with $10,000. Every round we draw one real outcome from your choice and add it to your capital — so your decisions actually play out as you go.',
  },
  {
    selector: '[data-tour="cards"]',
    title: 'Two options each round',
    body: 'Every round pits a bolder “Growth” side against a calmer “Anchor” side. Each card lists that side’s possible results and how likely each one is.',
  },
  {
    selector: '[data-tour="bar"]',
    title: 'Your combined odds',
    body: 'This bar is everything that could happen given your split. Each block is a possible result — wider means more likely, green is a gain, red is a loss.',
  },
  {
    selector: '[data-tour="slider"]',
    title: 'Set your split',
    body: 'Drag to divide your $10,000 between the two sides. The bar above updates live as you move it, so you can see how the mix changes your odds.',
  },
  {
    selector: '[data-tour="next"]',
    title: 'Lock it in',
    body: 'Happy with your mix? Lock it in — a pointer spins and lands on one real outcome, which is added to your capital. There are no wrong answers; go with your gut.',
  },
]

const CARD_W = 340 // px
const HALO = 8 // px — spotlight padding around the target
const EDGE = 16 // px — viewport margin for the pinned card

type Box = { top: number; left: number; width: number; height: number }

type Props = {
  onClose: () => void
}

// One-time, in-context walkthrough shown on the first round (replayable via the
// "How it works" button). Each step scrolls its target into view, draws a
// spotlight ring around it, and pins an explanation card to a fixed viewport
// edge — top when the target sits low, bottom when it sits high — so the card
// never covers the thing it's describing and never needs fragile anchor math.
export default function Coachmarks({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const [box, setBox] = useState<Box | null>(null)

  useLayoutEffect(() => {
    const el = document.querySelector(STEPS[step].selector)
    // Center the target in the viewport, then read its (post-scroll) position.
    el?.scrollIntoView({ block: 'center', behavior: 'auto' })

    const measure = () => {
      const t = document.querySelector(STEPS[step].selector)
      if (!t) return
      const r = t.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    // Re-measure after the scroll settles, and keep the ring on the target if
    // the page scrolls or resizes underneath it.
    const t1 = window.setTimeout(measure, 50)
    const t2 = window.setTimeout(measure, 200)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step])

  const last = step === STEPS.length - 1
  const first = step === 0
  const finish = () => {
    markSeen()
    onClose()
  }
  const next = () => (last ? finish() : setStep((s) => s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  const { title, body } = STEPS[step]

  // Pin the card to the bottom edge, unless the spotlight sits low on screen —
  // then pin it to the top so it can't overlap the highlighted element.
  const targetLow = box ? box.top + box.height / 2 > window.innerHeight * 0.5 : false

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Spotlight — a transparent ring with a huge shadow dimming everything
          else. Only shown once the target has been measured. */}
      {box && (
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
      )}
      {/* Full-screen dim fallback before the first measurement (no flash of
          un-dimmed content). */}
      {!box && <div className="absolute inset-0 bg-[rgba(20,22,28,0.55)]" />}

      {/* Explanation card — pinned to a fixed viewport edge, horizontally
          centered. Robust: no dependence on the target's exact position. */}
      <div
        className="animate-fade-slide-up fixed left-1/2 -translate-x-1/2"
        style={{
          width: `min(${CARD_W}px, calc(100vw - ${EDGE * 2}px))`,
          ...(targetLow ? { top: EDGE } : { bottom: EDGE }),
        }}
      >
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
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
            <div className="flex items-center gap-2">
              {!first && (
                <button
                  type="button"
                  onClick={back}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:text-text"
                >
                  Back
                </button>
              )}
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
    </div>
  )
}
