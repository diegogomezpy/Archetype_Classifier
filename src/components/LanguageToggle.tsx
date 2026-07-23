import { useLang, type Lang } from '../i18n/i18n'

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
]

/**
 * Language switch. `inline` sits in the masthead beside the theme toggle; without
 * it the control floats bottom-right, which is how the one route that hides the
 * masthead (the test itself) still offers it. Hidden from the print report
 * either way, and the choice persists in localStorage.
 */
export default function LanguageToggle({ inline = false }: { inline?: boolean }) {
  const { lang, setLang } = useLang()

  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      className={
        inline
          ? 'no-print flex shrink-0 overflow-hidden rounded-full border border-border bg-surface'
          : 'no-print fixed bottom-4 right-4 z-40 flex overflow-hidden rounded-full border border-border bg-surface shadow-soft'
      }
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={lang === o.value}
          onClick={() => setLang(o.value)}
          className={`font-mono text-xs font-medium transition-colors ${
            inline ? 'px-2.5 py-1' : 'px-3 py-1.5'
          } ${lang === o.value ? 'bg-teal text-white' : 'text-muted hover:text-text'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
