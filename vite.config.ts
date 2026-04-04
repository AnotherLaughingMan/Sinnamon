import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Keep this package unbundled so its internal wasm URL resolves to node_modules/pkg/*.wasm.
    // Prebundling rewrites import.meta.url to .vite/deps, which breaks wasm loading in dev.
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/release/**',
        '**/dist/**',
        '**/out/**',
      ],
    },
  },
});