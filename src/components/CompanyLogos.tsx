import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { companyKeyFor, COMPANY_DISPLAY_NAMES, useCatalog } from '../lib/catalog'
import CompanyLogo from './CompanyLogo'
import { deleteLogo, listLogoKeys, logoImgUrl, uploadLogo } from '../lib/logos'
import { useLang } from '../i18n/i18n'

const pick = (lang: 'en' | 'es', en: string, es: string) => (lang === 'es' ? es : en)

// Admin panel: one logo per LOCAL company (Parqet doesn't cover Paraguayan
// tickers). Companies are the distinct issuers across local instruments; each
// logo is keyed by the normalized issuer slug so every instrument from that
// company picks it up. Bytes live in the per-company upload store (/api/logos).
export default function CompanyLogos() {
  const { lang } = useLang()
  const { instruments } = useCatalog()
  const [keys, setKeys] = useState<Set<string>>(new Set())
  const [bust, setBust] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)

  // Every distinct company in the catalog, deduped by its canonical key — local
  // issuers AND listed globals, so a logo can be supplied for any company whose
  // feed lookup comes up empty. Aliased names (Imperial SAE / Petromax) collapse
  // into one entry because companyKeyFor resolves them to the same key.
  const companies = useMemo(() => {
    const map = new Map<string, { name: string; ticker: string }>()
    for (const i of instruments) {
      const key = companyKeyFor(i)
      if (!key || map.has(key)) continue
      const local = (i.region ?? 'global') === 'local'
      const name = (
        local ? i.details.issuer || i.details.fundManager || i.name : i.details.issuer || i.name
      ).trim()
      map.set(key, {
        name: COMPANY_DISPLAY_NAMES[key] ?? name ?? i.name,
        ticker: local ? '' : (i.ticker ?? '').trim(),
      })
    }
    return [...map.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [instruments])

  const refresh = () =>
    listLogoKeys()
      .then((ks) => setKeys(new Set(ks.map((x) => x.key))))
      .catch(() => {})
  useEffect(() => {
    refresh()
  }, [])

  const onFile = async (key: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(key)
    try {
      await uploadLogo(key, file)
      setBust((b) => ({ ...b, [key]: Date.now() }))
      await refresh()
    } finally {
      setBusy(null)
    }
  }
  const onRemove = async (key: string) => {
    setBusy(key)
    try {
      await deleteLogo(key)
      setKeys((s) => {
        const n = new Set(s)
        n.delete(key)
        return n
      })
    } finally {
      setBusy(null)
    }
  }

  const withLogo = companies.filter((c) => keys.has(c.key)).length

  return (
    <details className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <summary className="cursor-pointer select-none text-sm font-semibold text-text">
        {pick(lang, 'Company logos', 'Logos de empresas')}
        <span className="ml-2 font-mono text-xs font-normal text-muted tnum">
          {withLogo}/{companies.length}
        </span>
      </summary>
      <p className="mt-2 text-xs text-muted">
        {pick(
          lang,
          'One logo per company (PNG or SVG, ideally square, transparent). Listed companies use their feed logo automatically — upload only when none is found. It applies to every instrument from that company.',
          'Un logo por empresa (PNG o SVG, idealmente cuadrado y transparente). Las empresas listadas usan su logo automáticamente — subí uno solo si no se encuentra. Aplica a todos los instrumentos de esa empresa.',
        )}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 min-[900px]:grid-cols-3">
        {companies.map((c) => {
          const has = keys.has(c.key)
          const isBusy = busy === c.key
          return (
            <div
              key={c.key}
              className="flex items-center gap-3 rounded-xl border border-border bg-bg/40 p-3"
            >
              {/* Same resolution chain as the report, so this shows exactly what
                  an advisor sees — feed logo, uploaded logo, or a monogram. */}
              <CompanyLogo
                key={`${c.key}-${bust[c.key] ?? 0}`}
                ticker={c.ticker}
                name={c.name}
                uploadKey={c.key}
                size={48}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{c.name}</p>
                <div className="mt-1 flex items-center gap-3">
                  <label className="cursor-pointer text-xs font-medium text-teal hover:underline">
                    {isBusy
                      ? pick(lang, 'Uploading…', 'Subiendo…')
                      : has
                        ? pick(lang, 'Replace', 'Reemplazar')
                        : pick(lang, 'Upload', 'Subir')}
                    <input
                      type="file"
                      accept="image/png,image/svg+xml,image/jpeg,image/webp"
                      className="hidden"
                      disabled={isBusy}
                      onChange={(e) => onFile(c.key, e)}
                    />
                  </label>
                  {has && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onRemove(c.key)}
                      className="text-xs text-muted/70 transition-colors hover:text-red"
                    >
                      {pick(lang, 'Remove', 'Quitar')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {companies.length === 0 && (
        <p className="mt-4 text-xs italic text-muted">
          {pick(lang, 'No local companies yet.', 'Aún no hay empresas locales.')}
        </p>
      )}
    </details>
  )
}
