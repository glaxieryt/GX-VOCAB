import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // We use process.cwd() to ensure we look in the right place during Vercel builds.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    define: {
      // Safely inject the API key. 
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      
      // Inject Supabase keys, checking both VITE_ prefixed (manual) and non-prefixed (Vercel Integration) names
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''),
      'process.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || env.SUPABASE_ANON_KEY || ''),
      
      // Fallback for other process.env accesses to prevent "process is not defined"
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env': {}, 
    }
  };
});