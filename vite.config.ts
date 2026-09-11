import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // GitHub Pages 项目页地址为 /<repo>/，资源路径需带上仓库名
  base: '/sologame/',
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
