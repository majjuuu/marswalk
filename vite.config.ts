import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the site at /<repo>/; the deploy workflow sets BASE_PATH=/marswalk/.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    environment: 'node', // engine code is pure TS, no DOM needed
  },
});
