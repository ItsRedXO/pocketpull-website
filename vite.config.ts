import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const RAILWAY_BACKEND = 'https://pocketpull-website-production.up.railway.app';

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
          if (!id.includes('/src/') || backendBase === RAILWAY_BACKEND) return null;
          if (!code.includes(RAILWAY_BACKEND)) return null;
          return { code: code.split(RAILWAY_BACKEND).join(backendBase), map: null };
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
