import type { RiskLevel } from './scoring'

// ---------------------------------------------------------------------------
// The 1–5 risk ladder, as theme-aware Tailwind classes
// ---------------------------------------------------------------------------
// One definition for every surface that paints a risk level: the advisor's
// holding chips and risk histogram, the admin risk model, the client's result.
// Previously each of those carried its own hex map, so the ladder drifted and —
// because the ink was drawn on a wash of ITSELF — the light theme rendered the
// digits at 1.7:1. The colours now live in index.css as --c-level-1..5 with a
// darkened light-mode set, so they survive both themes.
//
// Class strings are written out in full rather than composed, because Tailwind
// only ships classes it can find as literals in the source.

export const LEVEL_INK: Record<RiskLevel, string> = {
  1: 'text-level1',
  2: 'text-level2',
  3: 'text-level3',
  4: 'text-level4',
  5: 'text-level5',
}

/** A tint of the level's own colour, for chip and badge grounds. */
export const LEVEL_WASH: Record<RiskLevel, string> = {
  1: 'bg-level1/15',
  2: 'bg-level2/15',
  3: 'bg-level3/15',
  4: 'bg-level4/15',
  5: 'bg-level5/15',
}

/** Solid fill, for bars and dots where the colour is the mark itself. */
export const LEVEL_FILL: Record<RiskLevel, string> = {
  1: 'bg-level1',
  2: 'bg-level2',
  3: 'bg-level3',
  4: 'bg-level4',
  5: 'bg-level5',
}

export const LEVEL_BORDER: Record<RiskLevel, string> = {
  1: 'border-level1/40',
  2: 'border-level2/40',
  3: 'border-level3/40',
  4: 'border-level4/40',
  5: 'border-level5/40',
}

/** For SVG fills and any place that needs a raw colour rather than a class. */
export const levelColor = (level: RiskLevel): string => `rgb(var(--c-level-${level}))`

export const LEVELS: RiskLevel[] = [1, 2, 3, 4, 5]
