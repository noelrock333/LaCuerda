import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar variables de entorno desde el directorio padre (raíz del proyecto)
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const APP_PORT = env.APP_PORT || '3000'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: '../public',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/api': `http://localhost:${APP_PORT}`,
        '/TXT': `http://localhost:${APP_PORT}`
      }
    }
  }
})
