import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: { include: ['react', 'react-dom', 'react/jsx-runtime', 'framer-motion'] },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true, rewrite: path => path.replace(/^\/api/, '') } },
  },
});
