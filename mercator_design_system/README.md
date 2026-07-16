# Mercator — Design System

A portable, institutional design language: warm paper, ink, a deep viridian accent, and a
strict monospace **figure register**, set on a faint graph-paper ground. Originally designed
for a structured-products pricing tool; everything here is app-agnostic and works for any
site or product that wants a sober, precise, financial character.

## What's in this package
- `tokens/mercator.css` — the complete stylesheet: CSS custom properties (light + dark via
  `[data-theme]`), fonts, and helper classes (`.fig`, `.fig-unit`, `.delta-pos/.delta-neg`,
  `.eyebrow`, `.ledger`, `.ground`, focus ring, skeleton shimmer). Include it as-is or lift
  the tokens into your own setup.
- `assets/favicon.svg` — the meridian mark (viridian tile, paper glyph).
- `assets/BrandMark.tsx` — the mark as a React component (`{ size }`, `currentColor`).
- `references/` — the full visual spec as browsable HTML. **Open
  `Mercator - System.dc.html` first** — it's the index; every card links to a document
  (each loads `support.js` from the same folder + Google Fonts, so view them from within
  this folder, online).

## The system in one page

### Type — three voices
Load once in `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```
- **Source Serif 4** — titles and headings only. Italic for captions. Never for numbers.
- **Hanken Grotesk** — body, labels, buttons, UI.
- **IBM Plex Mono** — every numeral, code, unit, and eyebrow label, always tabular.

### THE REGISTER (the defining rule)
1. All figures in mono, `tabular-nums` (`.fig` / `.mono`).
2. Direction is signed + coloured: viridian `#15694E` up, rust `#9C3B30` down, `▲/▼` (`.delta-pos/.delta-neg`).
3. Units (`%`, `€`, `y`, `bps`) sit smaller + muted beside the figure (`.fig-unit`).
4. Tables are ruled ledgers: heavy `1.5px` ink header rule, hairline rows + verticals,
   numerics right-aligned (`.ledger`).
5. Eyebrows/overlines are mono uppercase, `0.08em` tracking (`.eyebrow`) — not sans.
6. The page shell sits on the faint graph-paper ground (`.ground`); opaque panels float above.

### Colour (light — dark set included in the CSS)
Paper `#F7F5EF` · ground `#F1EEE4` · surface `#FFFEFB` · ink `#1C241F` · muted `#5C635B` ·
faint `#8C9189` · border `#E6E1D5` · hairline `#ECE8DD` · **viridian `#15694E`** (accent,
positive, active) · accent tint `#E4EFE9` · rust `#9C3B30` (negative) · ochre `#9A6B1A`
(caution) · chart series 2/3 `#3F8A6F` / `#7EB4A0` · grid lines `#E7E0CF` / `#DDD4BF`.

### Shape & depth
Radius: cards 8–9, buttons/inputs 6, tags 4, modals 12, pills 999. Shadows sparing
(card `0 1px 2px rgba(40,35,20,.05)`; modal `0 24px 60px -16px rgba(15,22,17,.55)`).
Prefer hairline rules + whitespace over boxes. Focus = 3px viridian-tint halo.

### Motion (see `Mercator - Motion.dc.html` for live demos)
Chrome ≤200ms, no overshoot. Durations: micro 120 / base 160 / enter 200. Easings:
settle `cubic-bezier(.2,0,0,1)` (default), enter `(0,0,0,1)`, exit `(.4,0,1,1)`.
Only data/processes may run longer (progress bars, figures counting up ~700ms, charts
drawing in once on first reveal — never on hover or tab return). Overlays: scrim fade 160,
card 200 + 8px translateY; toasts enter 200 / exit 160. Honor `prefers-reduced-motion`:
all transitions → 0ms, figures snap.

## Reference documents (in `references/`)
- **System** — start here; linked index of everything.
- **Foundations** — type specimen, colour tokens, the register rules.
- **Iconography** — meridian mark, lockups, clear space, the 12-icon line set (24px grid,
  1.9 stroke, round caps, `currentColor`).
- **Elements** — tags, nav, signals, cards, financial components.
- **Controls** — inputs/selects/sliders/toggles/buttons in every state.
- **Charts** — fan, histogram, scatter, correlation, donut, line; the data-viz palette.
- **Overlays** — modal, confirmation dialog, toasts.
- **States** — empty, loading (determinate, no spinners), skeleton, error.
- **Motion** — durations, easings, live replayable transitions.
- **Pricer / Backtest & Live / Report / Mobile** — the system applied to full screens
  (desktop app, document output, 390px mobile) — use as composition examples.
- **Texture Options** — ground study; graph paper is canon.

## Adopting it on a new site
1. Add the font links + `tokens/mercator.css`.
2. Put `.ground` on the page shell; build panels as `--surface` cards with `--border`.
3. Set headings in the serif, UI in the grotesk; convert every number to the register
   (`.fig`, split units, signed deltas, `.ledger` tables, mono eyebrows).
4. Use the meridian mark + lockup rules from Iconography for branding.
5. Keep motion within the Motion doc's tokens.
