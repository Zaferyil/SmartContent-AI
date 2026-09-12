import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    // netlify.toml proxies to targetPort 3000. Without strictPort, Vite quietly
    // moves to 3001 when 3000 is busy (a leftover process from a crashed run),
    // Netlify keeps proxying to 3000, and the CLI dies with ECONNRESET. Failing
    // loudly here names the real problem instead.
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
