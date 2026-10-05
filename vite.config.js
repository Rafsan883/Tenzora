import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/\/(react|react-dom|react-router|react-router-dom)\//.test(id)) return 'vendor-react';
          if (id.includes('/hls.js/')) return 'vendor-hls';
          if (/\/(socket.io-client|engine.io-client)\//.test(id)) return 'vendor-socket';
          if (id.includes('/@tanstack/')) return 'vendor-query';
          if (/\/(i18next|react-i18next)\//.test(id)) return 'vendor-i18n';
          if (id.includes('/axios/')) return 'vendor-axios';
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/api/**']
    },
    proxy: {
      '/api/proxy': { target: 'http://127.0.0.1:5001', changeOrigin: true },
      '/api': { target: 'http://127.0.0.1:7860', changeOrigin: true },
      ...Object.fromEntries(['/auth', '/watchlist', '/progress', '/settings', '/notifications', '/users', '/ai', '/ai-bot', '/community', '/contact', '/reports', '/support'].map(route => [route, {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        bypass(req) {
          if (['/watchlist', '/settings', '/notifications', '/community'].includes(route) && req.headers['x-api'] !== 'true') return '/index.html';
        }
      }]))
    }
  }
})

