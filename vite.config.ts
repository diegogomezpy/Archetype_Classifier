import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // Served from a subpath on GitHub Pages (https://<user>.github.io/<repo>/).
  // Only applied to production builds so local dev/preview stay at '/'.
  base: command === 'build' ? '/Archetype_Classifier/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
}))
