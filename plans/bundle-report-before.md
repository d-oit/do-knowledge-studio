# Bundle Analysis Report (Before)

Generated: 2024-05-22
Tool: Vite/Rollup visualizer

## Chunk Sizes

| Chunk | Size | Gzip | Content |
|-------|------|------|---------|
| `index-DPxF94oU.js` | 590 KB | 161 KB | App code, React, lucide-react, shared components |
| `vendor-editor-Di8Hm-n3.js` | 441 KB | 137 KB | @tiptap + extensions |
| `vendor-sqlite-Dd5lDa_5.js` | 207 KB | 58 KB | @sqlite.org/sqlite-wasm |
| `vendor-graph-CbytwiyW.js` | 167 KB | 40 KB | sigma, graphology |
| `vendor-mindmap-Br3dI-dC.js` | 85 KB | 27 KB | mind-elixir |
| `vendor-search-B93h2up8.js` | 67 KB | 22 KB | @orama/orama |

**Total initial JS (index chunk):** 590 KB / 161 KB gzip

## Observations

1. **Main index chunk is large (590 KB)** — contains React, lucide-react, app shell code
2. **Vendor chunks are well-separated** — graph, mindmap, editor, sqlite, search all in separate chunks
3. **heavy features are absent from initial chunk** — graph (167 KB), mindmap (85 KB), editor (441 KB), sqlite (207 KB), search (67 KB) are all lazy-loaded
4. **lucide-react may contribute significantly** to the main chunk since icons are tree-shaken but the import surface is large

## Recommendations

1. Ensure all feature islands use `React.lazy()` + `Suspense` ✅ (already done)
2. Defer non-critical startup work behind `requestIdleCallback` 
3. Monitor main chunk size growth over time
4. Consider dynamic import of heavy lucide icon imports
