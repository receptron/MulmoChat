import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    outDir: 'dist/client',
  },
  server: {
    host: true,
    allowedHosts: ['.local'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      // presentHtml pages, served by the API server for the View's iframe
      '/artifacts/html': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
