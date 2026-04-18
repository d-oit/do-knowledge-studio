import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('sigma') || id.includes('graphology')) {
            return 'vendor-graph';
          }
          if (id.includes('mind-elixir')) {
            return 'vendor-mindmap';
          }
          if (id.includes('@tiptap')) {
            return 'vendor-editor';
          }
          if (id.includes('@sqlite.org/sqlite-wasm')) {
            return 'vendor-sqlite';
          }
          if (id.includes('@orama/orama')) {
            return 'vendor-search';
          }
        },
      },
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
