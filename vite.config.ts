import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['ws10.csie.ntu.edu.tw'],
  },
  optimizeDeps: {
    include: ['@googlemaps/js-api-loader'],
    force: true, // 強制重新優化
  },
})
