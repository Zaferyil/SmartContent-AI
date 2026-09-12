import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `netlify dev` runs Vite behind its own proxy and sets VITE_PORT=3000 so the
// two do not collide. Run directly (npm run dev), Vite takes 8888 itself —
// the port the R2 bucket's CORS policy already allows — and proxies function
// calls to `netlify functions:serve`, skipping the Netlify proxy entirely.
// That proxy is what crashes with ECONNRESET on some macOS + Node setups:
// https://github.com/netlify/cli/issues/7747
const PORT = Number(process.env.VITE_PORT) || 8888
const FUNCTIONS_PORT = Number(process.env.FUNCTIONS_PORT) || 9999

export default defineConfig({
  plugins: [react()],
  server: {
    port: PORT,
    host: true,
    // Without this Vite quietly moves to the next free port while whatever
    // proxies to it keeps using the old one — a confusing failure.
    strictPort: true,
    proxy: {
      '/.netlify/functions': {
        target: `http://localhost:${FUNCTIONS_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
