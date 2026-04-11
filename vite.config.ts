import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5190,
    proxy: {
      '/api': {
        target: 'http://localhost:9001/.netlify/functions',
        rewrite: path => path.replace(/^\/api/, ''),
        changeOrigin: true,
        timeout: 35000,
        proxyTimeout: 35000,
      },
    },
  },
})
