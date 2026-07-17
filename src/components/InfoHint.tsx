// A small "?" affordance that reveals an explanation on hover or keyboard
// focus. Text-only, no dependencies; the popover escapes its card because the
// ancestors don't clip overflow.
export default function InfoHint({
  text,
  side = 'top',
  align = 'center',
}: {
  text: string
  side?: 'top' | 'bottom'
  align?: 'center' | 'left'
}) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        className="flex h-[15px] w-[15px] items-center justify-center rounded-full border border-border bg-surface text-[9px] font-semibold leading-none text-muted transition-colors hover:border-teal hover:text-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-30 w-64 rounded-lg border border-border bg-surface p-2.5 text-left font-sans text-[11px] font-normal normal-case leading-relaxed tracking-normal text-muted opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        } ${align === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}
      >
        {text}
      </span>
    </span>
  )
}
