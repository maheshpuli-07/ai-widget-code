import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dev server for the widget IIFE bundle + demo page.
 * Usage: npm run dev:lib
 * Serves on http://localhost:5174:
 *   - /chat-widget.js (built from src/embed.jsx as IIFE)
 *   - /chat-widget.css
 *   - /embed-example.html (simple demo)
 */
export default defineConfig({
  publicDir: 'public',
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  server: {
    port: 5174,
    strictPort: false, // fallback if 5174 is in use
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
        extend: false,
        inlineDynamicImports: true,
        assetFileNames: 'chat-widget.[ext]',
      },
    },
  },
});
