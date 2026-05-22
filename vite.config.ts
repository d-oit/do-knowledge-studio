import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

function getPlugins(): PluginOption[] {
  const plugins: PluginOption[] = [react()];
  if (process.env.ANALYZE === 'true') {
    plugins.push(visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }) as PluginOption);
  }
  return plugins;
}

export default defineConfig({
  plugins: getPlugins(),
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
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
