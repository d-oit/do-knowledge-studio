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
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-graph',
              test: /sigma|graphology/,
            },
            {
              name: 'vendor-mindmap',
              test: /mind-elixir/,
            },
            {
              name: 'vendor-editor',
              test: /@tiptap/,
            },
            {
              name: 'vendor-sqlite',
              test: /@sqlite\.org\/sqlite-wasm/,
            },
            {
              name: 'vendor-search',
              test: /@orama\/orama/,
            },
          ],
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
