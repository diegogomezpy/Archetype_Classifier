import { useState } from 'react'

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

type Step = { title: string; body: string }

const STEPS: Step[] = [
  {
    title: 'Read the outcome bar',
    body: 'The colored bar shows every possible result. Wider means more likely — green is a gain, red is a loss.',
  },
  {
    title: 'Set your mix',
    body: 'Drag the slider to split your $10,000 between the Growth side and the Steady side. The bar updates as you move it.',
  },
  {
    title: 'Go with your gut',
    body: 'Happy with the mix? Tap Next. There are no right or wrong answers — your instinct is the signal.',
  },
]

type Props = {
  onClose: () => void
}

// One-time, in-context walkthrough shown on the first allocation round. Dimmed
// backdrop with a stepped card. Dismissal (finish or skip) is persisted so it
// never reappears for a returning client.
export default function Coachmarks({ onClose }: Props) {
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1

  const finish = () => {
    markSeen()
    onClose()
  }

  const next = () => (last ? finish() : setStep((s) => s + 1))

  const { title, body } = STEPS[step]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-text/40 px-6 backdrop-blur-[2px]">
      <div className="animate-fade-slide-up w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-teal">
            How it works
          </span>
          <span className="font-mono text-xs text-muted tnum">
            {step + 1} / {STEPS.length}
          </span>
        </div>

        <h3 className="mt-4 text-xl font-semibold tracking-tight text-text">{title}</h3>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">{body}</p>

        {/* Step dots */}
        <div className="mt-5 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-5 bg-teal' : 'w-1.5 bg-surface2'
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
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
            {last ? "Got it" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
