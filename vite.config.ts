import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const LEGACY_BACKEND = 'https://b2nnhe2n.backend.blink.new';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredBackend = String(env.VITE_BACKEND_URL || '').trim().replace(/\/$/, '');
  const backendBase = configuredBackend || LEGACY_BACKEND;

  return {
    plugins: [
      {
        name: 'pocketpull-backend-cutover',
        enforce: 'pre',
        transform(code, id) {
          if (!id.includes('/src/') || backendBase === LEGACY_BACKEND || !code.includes(LEGACY_BACKEND)) return null;
          return { code: code.split(LEGACY_BACKEND).join(backendBase), map: null };
        },
      },
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
      // @blinkdotnew/ui + framer-motion + R3F peers must share one React instance or hooks
      // crash inside motion with: Cannot read properties of null (reading 'useRef')
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
