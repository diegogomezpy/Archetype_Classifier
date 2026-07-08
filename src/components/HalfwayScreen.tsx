import { useT } from '../i18n/i18n'

type Props = {
  onContinue: () => void
}

// Brief transition between screen 1 (rounds 1-5) and screen 2 (rounds 6-10).
// No scores are shown here by design.
export default function HalfwayScreen({ onContinue }: Props) {
  const t = useT()
  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center px-6 py-16">
      <div className="animate-fade-slide-up flex w-full max-w-md flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/12 font-mono text-xl font-medium text-teal tnum shadow-soft">
          5/10
        </span>

        <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight text-text sm:text-4xl">
          {t.halfway.title}
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-muted">{t.halfway.body}</p>

        <button
          type="button"
          onClick={onContinue}
          className="mt-12 w-full max-w-sm rounded-2xl bg-teal py-4 text-base font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0"
        >
          {t.halfway.continue}
        </button>
      </div>
    </div>
  )
}
