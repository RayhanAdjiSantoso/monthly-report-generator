import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Matches production's shape (frontend/api rewrite on one origin, see
    // ../vercel.json) so the app can call relative /api/... paths in both
    // places — api.ts no longer needs a hardcoded localhost fallback.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
