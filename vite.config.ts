import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 5000,
  },
  // FIX: Standardized environment variables to remove the 'VITE_' prefix.
  // This aligns with the deployment platform's standard variable names (e.g., API_KEY)
  // and ensures they are correctly injected during the build process.
  define: {
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
    'process.env.SUPABASE_KEY': JSON.stringify(process.env.SUPABASE_KEY),
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  }
});