
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    // Use `define` for global constant replacements. This is more reliable
    // in environments where `import.meta.env` might not be populated.
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      // Manually define Supabase keys to ensure they are available in production.
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'process.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY || ''),
    }
  };
});