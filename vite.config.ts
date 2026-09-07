import { defineConfig } from 'vitest/config';

// GitHub Pages serves project sites under /<repo>/. Override with VITE_BASE=/ for root hosting.
const base = process.env.VITE_BASE ?? '/suika-jelly/';

export default defineConfig({
  base,
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node' },
});
