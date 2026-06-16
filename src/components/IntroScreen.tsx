type Props = {
  onStart: () => void
}

const STATS = [
  { value: '13', label: 'Decisions' },
  { value: '~3 min', label: 'To complete' },
  { value: '5', label: 'Profiles' },
]

export default function IntroScreen({ onStart }: Props) {
  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center px-6 py-16">
      <div className="animate-fade-slide-up flex w-full max-w-xl flex-col items-center text-center">
        <p className="mb-10 font-mono text-xs uppercase tracking-[0.22em] text-teal">
          CADIEM · Investor Profile
        </p>

        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-text sm:text-[3.25rem]">
          What kind of investor are you?
        </h1>

        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
          13 quick decisions. No right answers. Go with your instinct.
        </p>

        <div className="mt-14 grid w-full max-w-lg grid-cols-3 gap-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center rounded-2xl border border-border bg-surface px-2 py-6 shadow-soft"
            >
              <span className="font-mono text-2xl font-medium text-text tnum">{s.value}</span>
              <span className="mt-2 text-sm text-muted">{s.label}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-14 w-full max-w-sm rounded-2xl bg-teal py-4 text-base font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0"
        >
          Start
        </button>

        <p className="mt-6 text-sm text-muted">
          Each round takes under 30 seconds. There are no wrong choices.
        </p>
      </div>
    </div>
  )
}
