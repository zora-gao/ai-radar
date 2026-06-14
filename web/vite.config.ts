import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/ai-news-aggregator/' : '/',
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: ['..']
    }
  },
  // 使用默认 publicDir（web/public），其中 data 为指向 ../../data 的软链。
  // 注意：原配置 publicDir 指向项目根目录，会把 node_modules 当作静态资源直接返回，
  // 导致 vite client 的 env.mjs 绕过 transform、__DEFINES__ 占位符不被替换而白屏。
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
