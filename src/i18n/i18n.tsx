import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { STRINGS, type UIStrings } from './strings'

export type Lang = 'en' | 'es'

const LANG_KEY = 'ip_lang_v1'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    /* ignore */
  }
  // Spanish-first: the audience is a Paraguayan brokerage, so default to ES
  // unless the visitor's browser is explicitly English. A saved choice wins.
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en')
    ? 'en'
    : 'es'
}

const LanguageContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'es',
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang
    document.title = lang === 'es' ? 'Perfil del Inversor' : 'Investor Profile'
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>
  )
}

export function useLang(): { lang: Lang; setLang: (l: Lang) => void } {
  return useContext(LanguageContext)
}

/** The full typed UI string table for the active language. */
export function useT(): UIStrings {
  return STRINGS[useContext(LanguageContext).lang]
}

/** Locale for date formatting. Numbers/currency stay en-US in both languages. */
export function dateLocale(lang: Lang): string {
  return lang === 'es' ? 'es' : 'en-US'
}
