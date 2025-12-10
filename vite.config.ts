
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  // This 'define' block is crucial for Vercel deployment.
  // It takes the environment variables available during the build process (on Vercel's servers)
  // and replaces the 'process.env.X' placeholders in the code with their actual string values.
  // This makes the keys available in the final client-side code.
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
    'process.env.SUPABASE_KEY': JSON.stringify(process.env.SUPABASE_KEY),
  },
});
