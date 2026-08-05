import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const LOCAL_WORKER_ORIGIN = 'http://localhost:8787'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: LOCAL_WORKER_ORIGIN,
        changeOrigin: true,
      },
    },
  },
})
