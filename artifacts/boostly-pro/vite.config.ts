import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT || '3000';
const port = Number(rawPort);

const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
      // Restored source files are intentionally retained under .migration-backup;
      // resolve their bare dependencies from this artifact's installed package set.
      'react': path.resolve(import.meta.dirname, 'node_modules/react'),
      'react-dom': path.resolve(import.meta.dirname, 'node_modules/react-dom'),
      'react-router-dom': path.resolve(import.meta.dirname, 'node_modules/react-router-dom'),
      '@tanstack/react-query': path.resolve(import.meta.dirname, 'node_modules/@tanstack/react-query'),
      'lucide-react': path.resolve(import.meta.dirname, 'node_modules/lucide-react'),
      'date-fns': path.resolve(import.meta.dirname, 'node_modules/date-fns'),
      'sonner': path.resolve(import.meta.dirname, 'node_modules/sonner'),
      'react-markdown': path.resolve(import.meta.dirname, 'node_modules/react-markdown'),
      'recharts': path.resolve(import.meta.dirname, 'node_modules/recharts'),
      'framer-motion': path.resolve(import.meta.dirname, 'node_modules/framer-motion'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
