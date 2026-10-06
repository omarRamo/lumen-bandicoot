import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: ['es2022', 'safari15', 'chrome90'],
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
});
