import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import eslint from 'vite-plugin-eslint'
import path from 'path'

export default defineConfig({
  plugins: [react()], // ESLint désactivé pour éviter les erreurs de configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['ai.intelios.us', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: true,
  },
})
