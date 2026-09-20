import { defineConfig } from 'vite';

// 构建结果放在任意子目录都可访问，包括 GitHub Pages /show/projects/apple-explorer/。
export default defineConfig({ base: './' });
