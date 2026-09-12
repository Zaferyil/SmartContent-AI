import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        pathRewrite: { '^/.netlify/functions': '' }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  }
})
