import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * IIFE bundle for third-party sites.
 * After build, `npm run build` runs scripts/patch-dist.mjs (adds index.html, demos, API from src/publicApiBase.js).
 */
export default defineConfig({
  publicDir: false,
  plugins: [react()],
  /** React's CJS builds reference process.env.NODE_ENV; browsers have no `process`. */
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'src/embed.jsx'),
      name: 'ChatWidgetEmbed',
      formats: ['iife'],
      fileName: () => 'chat-widget.js',
    },
    rollupOptions: {
      output: {
        /** Avoid merging into a polluted global; final API is set in embed.jsx via queueMicrotask. */
        extend: false,
        inlineDynamicImports: true,
        assetFileNames: 'chat-widget.[ext]',
      },
    },
  },
});
