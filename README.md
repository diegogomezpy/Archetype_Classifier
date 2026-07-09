# Investor Profile

A gamified investor risk-profiling web app. The client makes a series of quick
investment decisions, and the app builds a behavioral risk profile from those
choices — classifying them into one of five investor archetypes and producing
an advisor-facing dashboard with a suggested asset allocation and a ranked list
of fitting instruments.

Built as a single-page app with **React + TypeScript + Vite + Tailwind CSS +
React Router** — no external UI libraries.

## Localization

The whole app is bilingual **English / Spanish** — a fixed toggle (bottom-right)
switches live and persists in `localStorage`; the default follows the browser
language. The i18n layer is dependency-free (`src/i18n/`): UI chrome strings
live in typed tables (`strings.ts`), while content translations (round cards,
archetype copy, asset-class labels, advisor talking points) are layered over
the English data files at render time (`content.ts`, `advisorCopy.ts`) — the
scoring engine only ever sees ids, probabilities, and amounts, so language has
zero effect on results. Dollar amounts keep en-US formatting in both languages.

## Routes

Hash-based routing (works on static hosting with no server rewrites):

| Route | Audience | What |
|-------|----------|------|
| `#/` | Client (public) | The 10-round test. Client enters their name and picks their advisor, then gets their archetype + brief description only. Completing it saves a session. |
| `#/advisor` | Advisor | A one-click "Who are you?" picker → that advisor's clients, each with their play history. |
| `#/advisor/client/:clientId` | Advisor | One client's session history, newest first (replays accumulate here). |
| `#/advisor/session/:id` | Advisor | One session's dashboard: classification, allocation, and recommended instruments with per-asset detail drill-down. Strictly advisor-facing. |
| `#/admin` | Admin | Instrument catalog console: curate everything offerable to clients — risk vectors (σ/α/λ), visibility, "house pick" emphasis, and per-asset-class details. |
| `#/admin/archetypes` | Admin | Archetype console: edit the classification shape vectors (Banker/Venture/Insurer) and each archetype's recommended model asset mix. |
| `#/admin/advisors` | Admin | Advisor accounts: create the advisors clients pick from (just names). |

A consistent top nav (**Client test · Advisor · Admin**) sits on every screen
except mid-game. Everything (sessions, instrument catalog, archetype config,
advisors, clients) is persisted **server-side in Firestore** via the backend API
(`server/`), reached through a thin client (`src/lib/api.ts`) behind the same
store interfaces (`src/lib/storage.ts`, `src/lib/catalog.tsx`,
`src/lib/archetypeConfig.tsx`, `src/lib/directory.tsx`). So data is shared across
devices and browsers — an admin's edits and a client's sessions show up
everywhere, not just on the machine that made them. Only two things stay
device-local (`localStorage`): the language toggle and the advisor picker's
"who am I on this device" selection. The drawn game P&L is deliberately **not**
persisted — it's an engagement mechanic, not profile data.

### Advisor & client linking

**No logins (MVP).** The admin console is open, and an advisor "signs in" by
clicking their name on the Advisor tab (remembered on the device; "Switch
advisor" to change). Admins create advisors (name only). When a client plays,
they enter their name and pick their advisor, which links the session to both.
**Replays re-link to the same client** — a client is matched by (advisor +
normalized name), and the browser also remembers the last client for a one-tap
"continuing as…" on the intro. Each advisor's tab shows only their own clients.

> **Note.** This is MVP-grade scoping, not security. Data now lives server-side
> in Firestore, but the API is open (no auth) and the advisor "login" is just an
> unverified device-local pick — anyone who reaches the API or the admin console
> can read or change anything. Real enforcement (authenticated advisors,
> server-checked ownership) is deliberately deferred until the product is
> validated.

### Admin-configurable engine

The archetype **shape vectors** and the per-archetype **model asset mix** are
admin-editable at runtime, not hardcoded — and **any admin change is reflected
immediately on every advisor dashboard**. Advisor views never trust a session's
stored classification: they re-derive it from the session's stored *scores*
(`reclassifyScores`, `src/lib/scoring.ts`) against the current shape vectors, and
render the archetype's current model mix. Scores are language- and
vector-independent (they come only from the client's answers), so a saved session
always shows the current call. Each archetype's asset mix is an explicit model
portfolio, seeded from the allocation engine (`computeAllocation`) so defaults
match prior behavior, then editable and normalized to 100%. The offline scoring
harnesses (`scripts/`) never call `setActiveShapeVectors`, so they validate
against the built-in defaults unchanged.

### Instrument catalog & asset details

Every instrument carries, besides its identity and risk vector, a per-class
detail sheet (defined in `ASSET_FIELD_SPECS`, `src/lib/catalog.tsx`) that the
admin curates and the advisor sees when drilling into a recommendation:

- **Equities** — type (stock/ETF), sector or index tracked, exchange, last
  price, 1-year change, 52-week range, average volume, market cap/AUM,
  dividend yield, P/E (stocks), expense ratio (ETFs), beta, ATM 3M implied vol
- **Fixed income** — issuer, coupon rate & frequency, maturity, duration,
  yield to maturity, credit rating, minimum investment, currency
- **Income structures** — underlying(s), coupon/premium, protection barrier,
  autocall level, observation frequency, maturity, issuer & rating, capital
  protection, worst-case scenario
- **Growth structures** — underlying(s), participation rate, upside cap,
  protection level, maturity, issuer & rating, worst-case scenario
- **Alternatives** — underlying exposure, expense ratio, distribution yield,
  average volume, diversification role
- **Crypto** — last price, 1-year change, market cap, average volume,
  custody/wrapper form, ATM 3M implied vol, volatility/drawdown note
- **Cash/MMF** — current yield, average maturity, minimum investment, expense
  ratio

The bundled universe is a deliberately small **bare-bones example set** (~25
instruments across the classes, `src/lib/instruments.ts`), each shipping with an
illustrative sample detail sheet (`src/data/instrumentDetails.ts`, all marked
with a "data as of" field). It seeds the admin-managed catalog; admins add,
edit, hide, and emphasize from there.

**Autofill.** When adding an instrument, the admin enters a ticker (or ISIN) and
hits "Fetch data". The browser posts the identity to the backend
(`POST /api/market-data`), which does the fetching server-side (`server/src/marketData.ts`) —
no keys or CORS limits in the browser. The client side (`src/lib/marketData.ts`)
is just a thin call to that endpoint:

- **Equities/ETFs → Yahoo Finance** (`yahoo-finance2`, keyless) — description,
  price, 1-year change, 52-week range, volume, market cap, dividend yield, P/E,
  beta, and **ATM ~3-month implied vol** from the option chain. Yahoo's default
  data host (`query2`) returns 429 for Google Cloud IPs, so the server routes
  calls to `query1` with a browser `User-Agent` (see the note in
  `server/src/marketData.ts`) — that mirrors the working crumb request and gets
  past the block.
- **Crypto → CoinGecko + Deribit** (both keyless) — CoinGecko fills last price,
  1-year change, market cap, and volume; **Deribit DVOL** fills crypto ATM
  implied vol.

Fetched fields are formatted (compact `$1.2T`, signed `+38.4%`) and merged
non-destructively — a fetch never blanks a field the admin already filled.

**What stays manual:** bond/structured-product reference data (coupon, rating,
barriers — OTC desk data with no free API). Those fields are in the schema and
editable, just not auto-fillable.

## How it works

The profiler runs as a **10-round game across two screens** (a brief halfway
interstitial sits between them — rounds 1–5 on screen 1, rounds 6–10 on screen
2). Every round is an allocation slider: the client splits $10,000 between two
sides. The **Growth** side (`X`) is always the more aggressive / higher-variance
/ skew-seeking option; the **Anchor** side (`Y`) is the calmer one. Outcomes are
framed as gains/losses vs. the $10,000 input.

### Paired, all-mismatched design

The ten rounds are **5 payoff-shape contrasts × 2**. Every round has a slightly
richer side (one side's average outcome is higher, by ~$200–350 — the gap is
never stated). Each contrast is tested twice, with the **richer side flipped**:

- the **"a"** round (screen 1) makes the aggressive **Growth** side the richer one;
- the **"b"** round (screen 2) makes the calm **Anchor** side the richer one.

The five contrasts are variance, skew, loss aversion, combined risk profile, and
lottery (long-shot) skew. Scoring then separates two things cleanly:

- **Shape** (σ, α, λ) — the *average* of a pair. The EV pull points opposite ways
  in the two rounds, so it cancels; what's left is the player's payoff-shape taste.
- **EV-discipline** (ev) — the *difference* within a pair. A pure-shape player
  answers both rounds the same way (ev cancels); a player who chases the richer
  side splits them (ev accumulates).

After locking in each round, the app **draws one real outcome** from the
player's chosen distribution (a spinning pointer lands on a segment, and the
segment *is* the result) and adds it to a running total — a single,
non-re-rollable draw per round, surfaced as "Your run" on the dashboard. The
draw is purely for engagement; the profile is scored only from the *choices*.

### The four dimensions

| Dimension | Meaning |
|-----------|---------|
| **σ (sigma)** | Variance tolerance |
| **α (alpha)** | Skew preference (taste for positive vs. negative skew) |
| **λ (lambda)** | Loss aversion |
| **ev** | EV-discipline (chases the higher expected value vs. a preferred shape) |

σ and α are read from signed slider weights (see `ROUND_SCORES` in `scoring.ts`).
**ev** is read from each round's actual EV gap (`evGap`): leaning toward the
richer side accumulates `ev`, weighted by how much richer that side is, so
bigger-gap rounds count more. **λ is handled differently again**: a linear slider
weight conflated it with σ, so λ is instead derived from the *realized downside*
the player signed up for — **expected shortfall**, scoring how far they leaned
toward the safer side.
The two pure-skew contrasts are excluded from λ because their loss tail reflects
skew taste, not loss aversion.

### Classification

The base archetype is decided by payoff **shape** only (σ, α, λ), matched by
**cosine similarity** against **three** shape vectors — **Banker**, **Venture
Capitalist**, and **Insurer**. The other two archetypes are not directions in
shape space and are handled specially:

- **The Quant** is an *additive overlay*: when EV-discipline is strong enough
  (`ev ≥ EV_TAG`), the result becomes "<shape> + Quant" (or a pure Quant when the
  player has no shape tilt at all). It's a discipline that sits on top of a risk
  personality, not a competing one.
- **The Indexer** is the *low-conviction outcome*: when the player's style tilt
  (skew + loss-shape, √(α²+λ²)) is below `STYLE_MIN`, there's no archetype
  identity, so "own the market" wins.

Every result carries a **confidence** score (conviction × separation) and is
flagged **tentative** when confidence is low. Asset-class allocation and
instrument ranking on the advisor dashboard are driven by the `(σ, α, λ)` shape
vector (the Quant gets a fixed 90% equities / 10% crypto book).

## Getting started

**Prerequisites:** Node.js 18+ and npm.

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:5173)
npm run dev

# Type-check and build for production
npm run build

# Preview the production build locally
npm run preview
```

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check (`tsc --noEmit`) and build to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm run preview` | Serve the production build locally |

The two files in `scripts/` (`audit.ts`, `coverage.ts`) are offline validation
harnesses for the scoring model — persona tests and a Monte-Carlo sweep over the
answer space. They aren't wired into `package.json`; run them ad hoc, e.g.
`npx tsx scripts/coverage.ts`.

## Project structure

```
src/
├── App.tsx                 # Route shell (HashRouter): test / advisor / admin
├── main.tsx                # React entry point
├── types.ts                # Shared types (rounds, scores)
├── index.css               # Tailwind layers + animations + print styles
├── pages/
│   ├── TestFlowPage.tsx    # Client flow: intro → rounds → interstitial → own profile
│   ├── AdvisorListPage.tsx # Advisor: "who are you?" picker + their client list
│   ├── AdvisorClientPage.tsx # Advisor: one client's session history
│   ├── AdvisorSessionPage.tsx # Advisor: one session's dashboard
│   ├── AdminPage.tsx       # Admin: instrument catalog console (CRUD + details)
│   ├── AdminArchetypesPage.tsx # Admin: archetype vectors + model asset mixes
│   └── AdminAdvisorsPage.tsx # Admin: advisor account management
├── i18n/
│   ├── i18n.tsx            # Language context/provider + hooks (en/es)
│   ├── strings.ts          # UI chrome strings, both languages
│   └── content.ts          # Round/archetype/asset-class translations + helpers
├── components/
│   ├── IntroScreen.tsx     # Landing screen (name + advisor pick, "continue as")
│   ├── ClientResult.tsx    # Client end screen: archetype + description only
│   ├── LanguageToggle.tsx  # Fixed EN/ES switch (all routes)
│   ├── RoundScreen.tsx     # Thin per-round wrapper → RoundDecision
│   ├── RoundDecision.tsx   # Allocation round: payoff distribution + slider + draw
│   ├── RoundProgress.tsx   # Segmented per-round progress indicator
│   ├── Coachmarks.tsx      # One-time in-context tutorial (first round)
│   ├── Scoreboard.tsx      # Running capital / profit tally above the bar
│   ├── DrawPointer.tsx     # Spinning pointer that lands on the drawn outcome
│   ├── PayoffBar.tsx       # Canvas payoff-distribution bar (joint outcomes)
│   ├── HalfwayScreen.tsx   # Screen 1 → screen 2 transition
│   ├── AdvisorDashboard.tsx# Two-panel session view (advisor route only)
│   ├── AppNav.tsx          # Global top nav (Client test / Advisor / Admin)
│   ├── AdminNav.tsx        # Admin sub-tabs (Instruments / Archetypes / Advisors)
│   ├── RecommendationsPanel.tsx # Classification + allocation + instruments (advisor-framed)
│   ├── AdvisorPanel.tsx    # Raw scores, confidence, talking points
│   ├── DonutChart.tsx      # Pure-SVG allocation donut
│   ├── InstrumentTabs.tsx  # Per-asset-class tabs (screen) / stacked sections (print)
│   ├── InstrumentList.tsx  # Ranked fit list with per-asset detail drill-down
│   └── DimensionScoreBar.tsx
├── hooks/
│   └── useDrawSequence.ts  # Draw count-up animation state machine
├── data/
│   ├── rounds.ts           # The 10 round definitions
│   ├── archetypes.ts       # Archetype copy + keys (shape vectors live in scoring.ts)
│   └── instrumentDetails.ts# Seed per-asset detail sheets (illustrative samples)
└── lib/
    ├── scoring.ts          # Scoring pipeline, classification, allocation engine
    ├── api.ts              # Thin fetch client for the backend API (/api)
    ├── storage.ts          # Session store → POST/GET /api/sessions
    ├── catalog.tsx         # Managed instrument catalog: field specs, provider (API-backed)
    ├── archetypeConfig.tsx # Editable shape vectors + per-archetype model mixes (API-backed)
    ├── directory.tsx       # Advisors (API-backed) + one-click advisor picker
    ├── marketData.ts       # Autofill: thin POST to /api/market-data
    ├── outcomes.ts         # Joint payoff distribution + weighted draw sampling
    ├── instruments.ts      # Bundled instrument universe (seeds the catalog)
    └── advisorCopy.ts      # Advisor talking-point generation (en/es)

server/                     # Backend API (Node + Hono + Firestore), serves the built app too
└── src/
    ├── index.ts            # Hono app: /api routes + static frontend + SPA fallback
    ├── db.ts               # Firestore init (@google-cloud/firestore) + collections
    └── marketData.ts       # Server market data: Yahoo (equities) + CoinGecko/Deribit (crypto)
```

## Deployment

One container on **Cloud Run** (`npm run deploy` →
`gcloud run deploy investor-profile --source . --region us-central1 --allow-unauthenticated`).
The `Dockerfile` builds the Vite app and the Node server, then runs the server —
which serves the built app **and** the `/api` routes from the same origin, so
there are no CORS or cross-service concerns. The container scales to zero.
Firestore (native mode) lives in the same GCP project (`archetype-classifier`);
Cloud Run's runtime service account reaches it with project `editor` access — no
key files, no Firebase SDK. Live at
<https://investor-profile-41156376159.us-central1.run.app>.

### Local development

Two processes (see `CLI.md`):

- **API server** — `cd server && npm install && npm run dev` (port 8080). Needs
  Firestore credentials once: `gcloud auth application-default login`.
- **Frontend** — `npm run dev` (port 5173). Vite proxies `/api` → `:8080`.

## Notes

- **Desktop-first.** The layout targets desktop widths; it is not yet optimized
  for mobile.
- **Backend, but no logins/auth (MVP).** Data persists server-side in Firestore
  via the `server/` API, so it's shared across devices — but the API is open and
  the advisor "login" is an unverified device-local pick. Authenticated advisors
  and server-checked ownership are deferred until the product is proven. Scoring
  still runs client-side (the server only stores results and fetches market data).
- Fonts (DM Mono, Inter) are loaded from Google Fonts at runtime.
- The instrument universe and archetype copy are illustrative sample content.
