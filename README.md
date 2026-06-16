# Investor Profile

A gamified investor risk-profiling web app. The client makes a series of quick
investment decisions, and the app builds a behavioral risk profile from those
choices — classifying them into one of five investor archetypes and producing
an advisor-facing dashboard with a suggested asset allocation and a ranked list
of fitting instruments.

Built as a single-page app with **React + TypeScript + Vite + Tailwind CSS** —
no backend, no external UI libraries.

## How it works

The profiler runs as a **10-round game across two screens** (a brief halfway
interstitial sits between them):

- **Allocation rounds** — the client splits $10,000 between two sides. The
  **Growth** side (`X`) is always the more aggressive / higher-variance /
  skew-seeking option; the **Steady** side (`Y`) is the more conservative one.
  Outcomes are framed as gains/losses relative to the $10,000 input.
- **Liquidity rounds** — a binary choice between locking up capital for a
  modest premium versus staying liquid.

Each choice contributes a signed signal to four dimensions:

| Dimension | Meaning |
|-----------|---------|
| **σ (sigma)** | Variance tolerance |
| **α (alpha)** | Skew preference (taste for positive vs. negative skew) |
| **λ (lambda)** | Loss aversion |
| **liquidity** | Preference for liquidity over lockups |

The normalized `(σ, α, λ)` vector is matched by **cosine similarity** against
five archetype vectors — **Protector, Optimizer, Lottery Seeker, Carry
Collector, Agnostic**. The liquidity dimension then shapes the suggested
allocation and instrument ranking on the advisor dashboard.

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

## Project structure

```
src/
├── App.tsx                 # State machine: intro → playing → interstitial → dashboard
├── main.tsx                # React entry point
├── types.ts                # Shared types (rounds, scores, display modes)
├── index.css               # Tailwind layers + animations
├── components/
│   ├── IntroScreen.tsx     # Landing screen
│   ├── RoundScreen.tsx     # Per-round router (allocation → RoundDecision, else liquidity)
│   ├── RoundDecision.tsx   # Allocation round: portfolio mix + payoff distribution
│   ├── RoundProgress.tsx   # Segmented per-round progress indicator
│   ├── Coachmarks.tsx      # One-time in-context tutorial (first allocation round)
│   ├── PayoffBar.tsx       # Canvas payoff-distribution bar (joint outcomes, computed inline)
│   ├── LiqCards.tsx        # Liquidity choice cards
│   ├── HalfwayScreen.tsx   # Screen 1 → screen 2 transition
│   ├── AdvisorDashboard.tsx# Two-panel results view
│   ├── ClientPanel.tsx     # Client-facing profile + allocation
│   ├── AdvisorPanel.tsx    # Advisor-only raw scores + talking points
│   ├── DonutChart.tsx      # Pure-SVG allocation donut
│   ├── InstrumentList.tsx  # Ranked instrument fit list
│   ├── DimensionScoreBar.tsx
│   └── Icon.tsx            # Inlined Tabler icons
├── data/
│   ├── rounds.ts           # The 10 round definitions
│   └── archetypes.ts       # Archetype copy + target vectors
└── lib/
    ├── scoring.ts          # Scoring pipeline, classification, allocation engine
    ├── instruments.ts      # Instrument universe + asset-class loadings
    ├── advisorCopy.ts      # Advisor talking-point generation
    └── format.ts           # Money formatting helper
```

## Notes

- **Desktop-first.** The layout targets desktop widths; it is not yet optimized
  for mobile.
- **No backend.** All scoring runs client-side; nothing is persisted or sent
  anywhere.
- Fonts (DM Mono, Inter) are loaded from Google Fonts at runtime.
- The instrument universe and archetype copy are illustrative sample content.
