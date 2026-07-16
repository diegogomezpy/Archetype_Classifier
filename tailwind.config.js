/** @type {import('tailwindcss').Config} */
// Colours resolve to CSS variables (RGB triplets in src/index.css) so a single
// [data-theme] flip on <html> re-themes the whole app — and Tailwind's alpha
// modifiers (bg-teal/15, border-border/60) still work via <alpha-value>.
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`

module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mercator — warm paper, ink, deep viridian, on a graph-paper ground.
        bg: withAlpha('--c-bg'),
        bgElev: withAlpha('--c-bg-elev'),
        surface: withAlpha('--c-surface'),
        surface2: withAlpha('--c-surface-2'),
        surfaceHover: withAlpha('--c-surface-hover'),
        text: withAlpha('--c-text'),
        muted: withAlpha('--c-text-muted'),
        faint: withAlpha('--c-text-faint'),
        border: withAlpha('--c-border'),
        borderStrong: withAlpha('--c-border-strong'),
        hairline: withAlpha('--c-hairline'),
        // `teal` name kept (used everywhere) but now the deep viridian accent.
        teal: withAlpha('--c-accent'),
        tealHover: withAlpha('--c-accent-hover'),
        tealWeak: withAlpha('--c-accent-weak'),
        green: withAlpha('--c-accent'), // positive = the viridian family
        amber: withAlpha('--c-amber'),
        red: withAlpha('--c-red'),
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Mercator runs tighter/squarer than the old scale — remap the class names
      // the app already uses so radii shift app-wide with no per-component edits.
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '5px',
        md: '6px',
        lg: '6px',
        xl: '8px',
        '2xl': '9px',
        '3xl': '12px',
        full: '9999px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        soft: 'var(--shadow-soft)',
        thumb: 'var(--shadow-thumb)',
      },
    },
  },
  plugins: [],
}
