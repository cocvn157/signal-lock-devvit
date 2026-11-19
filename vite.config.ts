import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
});
