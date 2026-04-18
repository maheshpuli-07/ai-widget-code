import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Local dev: full page that mimics a host site + embedded widget. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  /** Match ai_banking_ui: Banking API default port 9000. */
  const apiOrigin = (
    env.API_PROXY_TARGET ||
    env.VITE_API_PROXY_TARGET ||
    env.VITE_API_BASE_URL ||
    'http://localhost:9000'
  ).replace(/\/$/, '');

  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': { target: apiOrigin, changeOrigin: true },
        '/auth': { target: apiOrigin, changeOrigin: true },
      },
    },
  };
});
