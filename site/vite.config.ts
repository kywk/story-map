import { defineConfig } from 'vite';

const base = process.env.SITE_BASE ?? '/story-map/';

export default defineConfig({
  base,
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
  },
});
