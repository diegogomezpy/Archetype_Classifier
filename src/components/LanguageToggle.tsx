import { useLang, type Lang } from '../i18n/i18n'

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
]

// Global language switch — fixed to the bottom-right corner on every route
// (hidden from the print report). Choice persists in localStorage.
export default function LanguageToggle() {
  const { lang, setLang } = useLang()

  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      className="no-print fixed bottom-4 right-4 z-40 flex overflow-hidden rounded-full border border-border bg-surface shadow-soft"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={lang === o.value}
          onClick={() => setLang(o.value)}
          className={`px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
            lang === o.value ? 'bg-teal text-white' : 'text-muted hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
