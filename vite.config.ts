import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// In production the Node server (server/) serves the built app and the API from
// the same origin, so base stays '/'. In dev, Vite serves the app on :5173 and
// proxies /api → the local API server on :8080.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
