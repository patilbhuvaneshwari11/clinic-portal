import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // All /api requests go through the ClearShield security gateway (port 3001)
      // which applies VelocityBreaker, Tarpit, and MemorySanitizer before
      // forwarding to the FastAPI backend on port 8000.
      // To bypass the gateway (dev-only), change 3001 → 8000 here.
      '/api': 'http://localhost:5000',
    }
  }
})
