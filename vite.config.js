import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: ['es2022', 'safari15', 'chrome90'],
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
  // pre-bundle up front so headless tests are never interrupted by a late dependency reload
  optimizeDeps: { include: ['three', 'three/examples/jsm/utils/BufferGeometryUtils.js'] },
});
