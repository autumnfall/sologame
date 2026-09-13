import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // 资源 base：默认 /sologame/（GitHub Pages 项目页）；腾讯云等根路径部署用 VITE_BASE=/ npm run build 覆盖
  base: process.env.VITE_BASE ?? '/sologame/',
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
