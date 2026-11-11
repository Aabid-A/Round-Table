import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Root is web/. `base: './'` keeps the static build working from any folder.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', emptyOutDir: true },
});
