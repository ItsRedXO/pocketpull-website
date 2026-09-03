import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const RAILWAY_BACKEND = 'https://pocketpull-website-production.up.railway.app';
const LEGACY_BLINK_BACKEND = 'https://b2nnhe2n.backend.blink.new';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredBackend = String(env.VITE_BACKEND_URL || '').trim().replace(/\/$/, '');
  const backendBase = configuredBackend || RAILWAY_BACKEND;

  return {
    plugins: [
      {
        name: 'pocketpull-backend-cutover',
        enforce: 'pre',
        transform(code, id) {
          if (!id.includes('/src/')) return null;
          let transformed = code;
          if (transformed.includes(RAILWAY_BACKEND)) {
            transformed = transformed.split(RAILWAY_BACKEND).join(backendBase);
          }
          if (backendBase === RAILWAY_BACKEND && transformed.includes(LEGACY_BLINK_BACKEND)) {
            transformed = transformed.split(LEGACY_BLINK_BACKEND).join(RAILWAY_BACKEND);
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
