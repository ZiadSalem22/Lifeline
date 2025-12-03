import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Use repo base in production, root in dev to avoid 500s on module fetch
  base: mode === 'production' ? '/Lifeline/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Use local trusted certs if present; otherwise fall back to HTTP
    https: (() => {
      const keyPath = path.resolve(__dirname, 'dev.key')
      const certPath = path.resolve(__dirname, 'dev.crt')
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      }
      return false
    })(),
    // Proxy API calls to the backend to avoid mixed content in HTTPS dev
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'date-fns': ['date-fns']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'date-fns']
  }
}))
