import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    define: {
      // Safely inject the API key. 
      // If env.API_KEY is undefined (build time vs run time), it might default to undefined,
      // so we use specific replacement to avoid replacing the whole `process.env` object
      // which causes libraries to crash.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      
      // Fallback for other process.env accesses to prevent "process is not defined"
      // BUT do NOT overwrite the specific keys defined above.
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env': {}, 
    }
  };
});