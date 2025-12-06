import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    define: {
      // Safely inject the API key. 
      // Vercel Environment Variables are accessed via process.env in the Node build environment.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Define a fallback for process.env to prevent "process is not defined" errors in browser
      'process.env': JSON.stringify({}),
    }
  };
});