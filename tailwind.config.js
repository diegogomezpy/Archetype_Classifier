/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Calm, light fintech palette
        bg: '#F5F4F0', // warm paper background
        surface: '#FFFFFF', // cards
        surface2: '#EDEBE5', // tracks, subtle fills
        text: '#23262F', // deep slate (softer than black)
        muted: '#7C808B', // secondary text
        teal: '#0AA088', // primary accent / X / gains
        amber: '#B5832C', // Y / loss-lean
        red: '#CE5454', // loss amounts
        border: '#E7E4DE', // soft hairlines
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(35,38,47,0.04), 0 14px 34px -20px rgba(35,38,47,0.22)',
        soft: '0 1px 2px rgba(35,38,47,0.05), 0 6px 18px -12px rgba(35,38,47,0.16)',
        thumb: '0 1px 3px rgba(35,38,47,0.18), 0 4px 12px -2px rgba(35,38,47,0.20)',
      },
    },
  },
  plugins: [],
}
