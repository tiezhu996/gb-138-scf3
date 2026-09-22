import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 本地开发时把 /api 代理到本机后端（默认 3000），与容器内 Nginx 的行为保持一致。
// 如需指向其他地址，可用 VITE_API_TARGET 覆盖。
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8238,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
