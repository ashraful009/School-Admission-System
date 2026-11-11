import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Frontend unit tests (bonus X2). Kept separate from vite.config.ts so the
// production build config stays unchanged. Run with: npm test
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})

