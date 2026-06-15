type Props = {
  onContinue: () => void
}

// Brief transition between screen 1 (rounds 1-8) and screen 2 (rounds 9-16).
// No scores are shown here by design.
export default function HalfwayScreen({ onContinue }: Props) {
  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center px-6 py-16">
      <div className="animate-fade-slide-up flex w-full max-w-md flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/12 font-mono text-xl font-medium text-teal tnum shadow-soft">
          8/16
        </span>

        <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight text-text sm:text-4xl">
          Halfway there
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-muted">
          Nice work — 8 more decisions to go. The next set explores how you feel about
          uncertainty and locking up your money.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="mt-12 w-full max-w-sm rounded-2xl bg-teal py-4 text-base font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
