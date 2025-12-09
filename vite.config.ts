
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This config is used for local development/preview.
// The production build uses a different mechanism for environment variables.
// We will rely on the production environment to substitute process.env variables directly.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
