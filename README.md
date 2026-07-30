# Investor Profile

An investor risk-profiling and portfolio-construction tool for a Paraguayan
brokerage. A client answers a short questionnaire; the app places them on two
axes, assigns a **1–5 risk band**, and hands their advisor a workspace that
builds, edits and sizes a real portfolio from a curated instrument catalog.

Three surfaces, one app:

- **Client test** — the questionnaire, and the client's own result.
- **Advisor** — the workspace: a suggested book, drag-and-drop editing,
  re-optimization, and a buy ticket sized to a capital amount.
- **Admin** — the instrument catalog, the screener that decides what advisors
  may see, and every knob behind the scoring and the optimizer.

Built as a single-page app with **React 18 + TypeScript + Vite + Tailwind CSS +
React Router**, plus a **Node + Hono + Firestore** backend that also serves the
built frontend. No external UI libraries.

The visual language is the **Mercator design system** (warm paper, ink, a deep
viridian accent, and three type voices — Source Serif 4 titles / Hanken Grotesk
UI / IBM Plex Mono figures — on a faint graph-paper ground), with a **light/dark
theme**. Colours live as RGB-triplet CSS variables in `src/index.css` (light +
dark under `[data-theme]` on `<html>`); `tailwind.config.js` maps its colour
tokens to those variables, so one attribute flip re-themes the whole app and
every `/15`-style opacity modifier keeps working. The source package sits in
`mercator_design_system/`.

---

## How the profile works

**Two axes, not a personality.** The client rates a handful of statements on a
5-point agree/disagree scale (`src/lib/questionnaire.ts`). Each statement feeds
exactly one axis, with a direction saying whether agreeing raises or lowers it:

| Axis | Meaning |
|---|---|
| `riskAversion` | Tolerance for volatility and drawdown |
| `liquidity` | How much access to the money the client needs |

`riskAversion` alone maps to a **fixed 1–5 risk band** via `BAND_THRESHOLDS`
(`src/lib/scoring.ts`) — `liquidity` never moves it. Liquidity instead feeds
per-instrument **fit** (weighted 0.35 against risk-match's 0.65), so a client who
needs access to their money isn't handed locked-up paper. It also feeds
`computeAllocation`, which *seeds* each band's model mix and backs the "recompute
from profile" button on the bands page — but once a mix is saved, the band's
stored preset is what the optimizer uses.

The questions, the bands, the risk model and the portfolio model are **all
admin-editable at runtime and persisted server-side**. Advisor views never trust
a session's stored classification: they re-derive it from the stored *answers*
(`reclassifyScores`), so an admin's edit is reflected immediately on every
existing session.

---

## How the portfolio is built

The band fixes the **% per asset class**. Optimization happens *within* each
class. All of it is admin-editable at `#/admin/portfolio`.

**Expected return.** Equities blend analyst price-target upside with a CAPM
estimate (`rf + β × ERP`); bonds use yield-to-worst; local instruments use the
bulletin's estimated yield.

**Volatility** comes from implied vol, or from duration + credit rating.

**Correlation is a four-factor model, not one number per class pair.** Every
instrument's volatility is decomposed onto four common factors — **global
equity, rates, credit, and the local (Guaraní) market** — plus an idiosyncratic
remainder. Two instruments correlate because they load on the same factors:

- **equity** loading = `β × market vol` for a listed share
- **rates** loading = `modified duration × rate vol` — so *duration*, not asset
  class, decides how much two bonds co-move
- **credit** loading = the vol implied by the credit rating
- **local** — local instruments sit on their own factor; Guaraní rates are not
  US rates

`cov(i,j) = LᵢᵀΦLⱼ + residual·idioᵢ·idioⱼ`, where the residual covers same
*issuer* (a company's bond against its stock) and same *sector* between two
equities. Loadings are rescaled so `cov(i,i) === vol²` exactly. Φ is forced
positive-definite by a Sylvester-criterion check that shrinks the off-diagonals
toward independence, so no admin input can hand the optimizer an unsolvable
matrix.

A 3-year A-rated bond and a 20-year Treasury come out at **0.60**, two 20-year
Treasuries at **0.95**, two same-sector equities **0.62**, cross-sector **0.37**,
equity against a Treasury **−0.09**. Under a flat model every one of those was
0.7 or 0.2.

**Weights.** Equities use max-Sharpe MVO: `w ∝ Σ⁻¹(μ − rf)` solved by Gaussian
elimination on the full covariance matrix with a ridge, long-only and per-name
capped. Bonds reward yield against the band's duration target. Funds and notes
are weighted by proximity to the client's level.

**Book size is one number.** `totalAssets` — how many instruments the suggested
portfolio holds altogether — is apportioned across the classes the band
allocates to by largest remainder, so a 76/24 band draws 76% of its names from
bonds. Every active class keeps a floor of one name.

---

## Routes

Hash-based routing (works on static hosting with no server rewrites).

| Route | Audience | What |
|---|---|---|
| `#/` | Client | The questionnaire. Client enters their name, picks their advisor, answers, and sees their band + description only. |
| `#/advisor` | Advisor | One-click "Who are you?" picker → that advisor's clients. |
| `#/advisor/client/:clientId` | Advisor | One client's session history, newest first. |
| `#/advisor/session/:id` | Advisor | **The workspace.** Metrics, risk/return scatter, class mix, the editable book, and the buy ticket. |
| `#/admin` | Admin | Instrument catalog: CRUD, per-class detail sheets, market-data autofill, CSV import, Cadiem bulletin PDF parsing, document attachments. |
| `#/admin/screener` | Admin | **Screen any class by its own traits, then publish that subset to advisors.** |
| `#/admin/questions` | Admin | The questionnaire statements, their axis and direction. |
| `#/admin/bands` | Admin | The five bands: name, colour, and the global + local model mixes. |
| `#/admin/risk` | Admin | How an instrument gets its 1–5 level (class base, credit-rating adjust, vol ladder). |
| `#/admin/portfolio` | Admin | The optimizer: rf, ERP, analyst blend, name cap, book size, level ceiling, per-band duration, and all 13 correlation params. |
| `#/admin/advisors` | Admin | Advisor accounts (names only). |

---

## The advisor workspace

The core loop: pick a client → read the suggested book → edit it → size the
ticket.

- **Headline metrics** on one line: expected return, volatility, return/risk,
  portfolio risk 1–5, average modified duration.
- **Editable holdings table** — per-row weight (decimals supported), remove, and
  a click-through to a full client-ready instrument report.
- **`ASSETS − 11/14 +`** — realized over requested. The optimizer can zero a name
  out, so the book is often smaller than the number asked for.
- **Re-optimize** re-weights exactly the names the advisor kept: the band mix
  applied to the classes present, renormalized to 100%, with no level ceiling
  since the advisor chose them deliberately.
- **Scale to 100%** appears only when the total drifts.
- **Build the ticket** turns a capital amount into whole units. Holdings with no
  unit price (local fixed income, CDs, structured notes carry no price field)
  still appear, marked `BY HAND` with the amount they're owed — their share is
  never silently handed to whichever line happens to have a price.

Capital is tracked **per region**, because $100,000 and ₲100.000 are not the
same order of magnitude and there is no FX source in the app.

---

## The screener

Advisors only ever see instruments flagged `visible`. The screener *is* that
flag, exposed as a filter.

Every class in both regions has a screen (`SCREENS` in `src/lib/traits.ts`) —
global equities / fixed income / structured notes, and local fixed income /
equities / CDs / mutual funds / investment funds — each filtering on the fields
that class actually carries:

- **Global equities** — price-target upside, buy-rated %, analysts covering,
  1-year change, β, implied vol, P/E, forward P/E, dividend yield, market cap
- **Global fixed income** — YTM, yield-to-call, coupon, duration, years to
  maturity, ETF yield, expense ratio, credit rating
- **Structured notes** — coupon/premium, barrier, autocall, participation, cap,
  capital protected, term, issuer rating
- **Local** — estimated yield, residual term, rating, unit price, minimum

Credit ratings are ordinal, so they render as a single "at least AA" select
rather than a pair of meaningless ladder indices. Local Paraguayan ratings carry
a country suffix (`AAApy`, `AA-py`) which is stripped before ranking.

A trait an instrument has **no value for fails a bounded filter** — screening on
"upside over 20%" must not quietly admit names with no analyst coverage at all.

---

## Instrument catalog

Global classes: **Fixed income · Equities · Structured notes**.
Local (Cadiem menu) categories: **Fixed income · Equities · CDs · Mutual funds ·
Investment funds**.

Each class splits into **subclasses** (`instrument.kind`) that gate which detail
fields show and whether market data can autofill them — a floating-rate note
shows its reference rate and spread, a TIPS shows breakeven inflation, a plain
fixed-rate bond shows neither. Global fixed income is a superset: bond **ETFs**
autofill from a ticker, while **individual bonds** mirror the broker's "Listado
de Bonos" columns 1:1 (ISIN, issuer, sector, country, bid, ask, YTM bid/ask,
coupon, duration, maturity, rating, YTC, next call).

The catalog **starts empty** — the admin builds it up.

**Autofill.** The admin enters a ticker or ISIN and hits Fetch. The browser posts
to the backend (`POST /api/market-data`), which fetches server-side — no keys or
CORS in the browser. Equities and ETFs come from **Yahoo Finance**
(`yahoo-finance2`, keyless): description, price, 1-year change, 52-week range,
volume, market cap, dividend yield, P/E, β, analyst consensus, and ATM ~3-month
implied vol from the option chain.

> Yahoo's default host (`query2`) returns **429 for Google Cloud IPs**, so the
> server routes calls to `query1` with a browser `User-Agent`. See the note in
> `server/src/marketData.ts`.

Fetched fields are formatted (compact `$1.2T`, signed `+38.4%`) and merged
non-destructively — a fetch never blanks a field the admin already filled, and
never touches the research firm's `rationale`.

**Bulk import.** Per-class CSV templates, a Bloomberg-export dictionary, and a
PDF parser for the local bulletin. Failed market-data fetches are reported, not
swallowed.

---

## Localization

The whole app is bilingual **English / Spanish**, toggled live and persisted in
`localStorage`, defaulting to the browser language.

- UI chrome lives in typed tables (`src/i18n/strings.ts`). `en` and `es` must
  match key-for-key — `es` is typed as `UIStrings`, so a missing key is a
  compile error.
- Spanish uses **voseo** (*poné, indicá, elegí, agregá, volvé*), matching
  Paraguayan usage — not tú, not usted.
- **Fetched free text is translated too.** Company descriptions and sector names
  arrive from Yahoo in English and are translated once via MyMemory (free,
  keyless) and cached alongside the English under `<key>Es`. So switching to
  Spanish localizes the *data*, not just the chrome.

MyMemory's quota is **per IP per day**, and a bulk import can exhaust it partway
— leaving rows permanently English, since a re-fetch only re-translates when the
*source* text changes. So the backfill sweep runs itself: at boot, coalesced
after catalog writes, and at the end of the daily refresh. That last one is what
guarantees convergence, because it runs inside a real request (Cloud Run only
allocates CPU then) and lands each morning on a fresh quota.

Numbers follow the region: `es-PY` groups with periods (₲1.050), `en-US` with
commas.

---

## Data & persistence

Everything — sessions, catalog, advisors, clients, and all four config
documents — is persisted **server-side in Firestore** through the backend API,
reached by a thin client (`src/lib/api.ts`) behind store interfaces
(`storage.ts`, `catalog.tsx`, `directory.tsx`, `bandConfig.tsx`,
`riskLevelsConfig.tsx`, `portfolioModelConfig.tsx`). Data is shared across
devices and browsers.

Only two things stay device-local: the language toggle and the advisor picker's
"who am I on this device".

Providers distinguish **loading**, **failed** and **empty** — a backend outage
renders as "could not reach the server" with a retry, never as the confident lie
"there are no advisors yet".

### Advisor & client linking

**No logins (MVP).** The admin console is open; an advisor "signs in" by clicking
their name (remembered on the device). Clients enter their name and pick their
advisor, which links the session to both. Replays re-link to the same client,
matched on (advisor + normalized name).

> **This is MVP-grade scoping, not security.** The API is open and the advisor
> "login" is an unverified device-local pick — anyone who reaches the API or the
> admin console can read or change anything. Authenticated advisors and
> server-checked ownership are deliberately deferred until the product is
> validated.

---

## Getting started

**Prerequisites:** Node.js 18+ and npm.

```bash
npm install
npm run dev        # http://localhost:5173
```

The frontend runs without the backend, but every data call fails and the catalog
renders empty. For real data you need both processes — see `CLI.md`.

| Script | What |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc --noEmit`) then build to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm run preview` | Serve the production build locally |
| `npm run deploy` | Build and deploy the container to Cloud Run |

---

## Project structure

```
src/
├── App.tsx                    # Route shell (HashRouter) + all providers
├── index.css                  # Mercator colour layer (light/dark) + helpers
├── pages/
│   ├── TestFlowPage.tsx       # Client: intro → questionnaire → own result
│   ├── AdvisorListPage.tsx    # Advisor picker + that advisor's clients
│   ├── AdvisorClientPage.tsx  # One client's session history
│   ├── AdvisorSessionPage.tsx # Loads a session → AdvisorDashboard
│   ├── AdminPage.tsx          # Instrument catalog console
│   ├── AdminScreenerPage.tsx  # Screen a class by trait → publish `visible`
│   ├── AdminQuestionsPage.tsx # Questionnaire statements
│   ├── AdminBandsPage.tsx     # The five bands + their model mixes
│   ├── AdminRiskPage.tsx      # Instrument 1–5 level derivation
│   ├── AdminPortfolioPage.tsx # Optimizer + the four-factor correlation model
│   └── AdminAdvisorsPage.tsx  # Advisor accounts
├── components/
│   ├── AdvisorDashboard.tsx   # The workspace (metrics, book, ticket, ficha)
│   ├── InstrumentReport.tsx   # Client-ready per-instrument report
│   ├── QuestionnaireScreen.tsx# The Likert screen
│   ├── IntroScreen.tsx        # Name + advisor pick
│   ├── ClientResult.tsx       # Client end screen: band + description only
│   ├── ImportInstruments.tsx  # CSV / Bloomberg / bulletin-PDF import
│   ├── InstrumentDocs.tsx     # Document attachments
│   ├── RiskReturnScatter.tsx  # Pure-SVG vol/return scatter
│   ├── CompanyLogo.tsx        # Parqet logo by ticker + uploaded local logos
│   ├── AppNav.tsx / AdminNav.tsx
│   └── LanguageToggle.tsx / ThemeToggle.tsx / BrandMark.tsx
├── i18n/                      # i18n.tsx · strings.ts (en/es) · content.ts
├── data/archetypes.ts         # Band ids, colours, seed copy
└── lib/
    ├── portfolio.ts           # THE ENGINE — estimates, four-factor covariance,
    │                          #   MVO, apportionment, capital planning
    ├── scoring.ts             # Answers → axes → 1–5 band, fit score
    ├── questionnaire.ts       # Likert scale + statements
    ├── traits.ts              # Screenable traits + SCREENS (per region/class)
    ├── riskLevels.ts          # Instrument 1–5 derivation
    ├── riskPalette.ts         # The 1–5 colour ladder (one definition)
    ├── catalog.tsx            # Field specs, subclasses, catalog provider
    ├── bandConfig.tsx         # Bands + model mixes (API-backed)
    ├── riskLevelsConfig.tsx   # Risk model (API-backed)
    ├── portfolioModelConfig.tsx # Optimizer params (API-backed)
    ├── directory.tsx          # Advisors + device-local advisor pick
    ├── storage.ts             # Sessions
    ├── api.ts                 # Thin fetch client for /api
    ├── marketData.ts          # Autofill: thin POST to /api/market-data
    ├── importSchema.ts / csv.ts / bloombergDict.ts / bulletinParse.ts / pdfText.ts
    ├── documents.ts / logos.ts / issuer.ts / theme.tsx
    └── instruments.ts         # Taxonomy: regions, classes, palettes

server/                        # Node + Hono + Firestore; also serves the built app
└── src/
    ├── index.ts               # /api routes, static frontend, SPA fallback,
    │                          #   daily refresh, automatic translation sweep
    ├── db.ts                  # Firestore init + collections
    ├── marketData.ts          # Yahoo Finance (server-side)
    └── translate.ts           # EN→ES via MyMemory, with quota handling
```

---

## Deployment

One container on **Cloud Run**. The `Dockerfile` builds the Vite app and the Node
server, then runs the server — which serves the built app **and** the `/api`
routes from the same origin, so there are no CORS or cross-service concerns. The
container scales to zero.

```bash
npm run deploy
```

> **The GCP project has been deleted.** `archetype-classifier` was torn down on
> 2026-07-27, which removed the Cloud Run service, the Firestore database (the
> whole catalog, advisors and client sessions), both storage buckets, the
> container images and the Cloud Scheduler job. The code here is complete and
> unaffected. See **Bringing it back up** below.

### Bringing it back up

Within ~30 days of deletion the whole project — data included — can be restored:

```bash
gcloud projects undelete archetype-classifier
# then re-enable billing, and:
npm run deploy
```

After that window, a fresh environment needs:

1. A GCP project with billing enabled, and the Cloud Run, Cloud Build,
   Firestore, Artifact Registry and Cloud Scheduler APIs on.
2. **Firestore in native mode** in the same project. The Cloud Run runtime
   service account reaches it with project `editor` — no key files, no Firebase
   SDK.
3. A GCS bucket for instrument document attachments (`<project>-docs`).
4. The project id updated in `package.json`'s `deploy` script and in `CLI.md`.
5. `npm run deploy`.
6. The catalog rebuilt through the admin console — CSV import per class, or the
   Cadiem bulletin PDF for local instruments. Advisors and questions re-created
   at `#/admin/advisors` and `#/admin/questions`; bands, risk model and portfolio
   model seed themselves from the built-in defaults on first load.

Optional but recommended:

- **`REFRESH_TOKEN`** env var + a Cloud Scheduler job POSTing to
  `/api/market-data/refresh` each weekday morning. This re-pulls Yahoo data,
  keeps analyst upside honest against the tape, and is what drives the Spanish
  translation sweep to convergence.
- **`TRANSLATE_CONTACT_EMAIL`** env var — raises the MyMemory translation cap
  from 5k to 50k words/day.

---

## Notes

- **Responsive, desktop-first.** The workspace is built for desktop but no page
  hands a phone a horizontal scrollbar; tables truncate and stack rather than
  clip their controls.
- **Accessibility.** Risk levels are encoded by number *and* colour, the ficha
  modal traps and restores focus, tables use real headers, and the muted/faint
  text tokens clear WCAG AA in both themes.
- Fonts are loaded from Google Fonts at runtime.
- `"Cadiem"` is deliberately kept out of UI chrome; it appears only inside real
  product names and imported data.
