import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const RAILWAY_BACKEND = 'https://pocketpull-website-production.up.railway.app';
const LEGACY_BLINK_BACKEND = 'https://b2nnhe2n.backend.blink.new';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredBackend = String(env.VITE_BACKEND_URL || '').trim().replace(/\/$/, '');

  // Production must never route economy/API calls back to Blink. Railway serves both
  // the frontend and the PostgreSQL-backed Hono API, so hard-pin production here.
  const backendBase = mode === 'production'
    ? RAILWAY_BACKEND
    : (configuredBackend || RAILWAY_BACKEND);

  return {
    plugins: [
      {
        name: 'pocketpull-backend-cutover',
        enforce: 'pre',
        transform(code, id) {
          if (!id.includes('/src/')) return null;
          let transformed = code;

          // Normalize every source reference to the selected backend. This includes
          // the old hardcoded Blink economy URL in src/lib/api.ts.
          if (transformed.includes(RAILWAY_BACKEND)) {
            transformed = transformed.split(RAILWAY_BACKEND).join(backendBase);
          }
          if (transformed.includes(LEGACY_BLINK_BACKEND)) {
            transformed = transformed.split(LEGACY_BLINK_BACKEND).join(backendBase);
          }

          if (transformed === code) return null;
          return { code: transformed, map: null };
        },
      },
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime', 'framer-motion'],
    },
    server: {
      port: 3000,
      strictPort: true,
      host: true,
      allowedHosts: true,
    },
  };
});
