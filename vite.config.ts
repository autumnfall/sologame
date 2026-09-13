/// <reference types="node" />
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // 资源 base：默认 /sologame/（GitHub Pages 项目页）；腾讯云等根路径部署用 VITE_BASE=/ npm run build 覆盖
  base: process.env.VITE_BASE ?? '/sologame/',
  plugins: [
    vue(),
    VitePWA({
      // prompt 模式：发现新版本后不强制刷新，由页面底部更新条让玩家手动点（避免打断游玩）
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '桌游收藏家',
        short_name: '桌游收藏家',
        description: '放置类桌游收藏游戏：工作赚钱、买桌游、开盒收集、挂某鱼出二手，退坑转生越玩越强。',
        lang: 'zh-CN',
        display: 'standalone',
        theme_color: '#16130f',
        background_color: '#16130f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        // 默认 glob 不含 png，补上以预缓存应用图标
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
