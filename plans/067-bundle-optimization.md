# 067 — Bundle Optimization (2026-07-17)

## Summary

Analyze and optimize bundle size by lazy-loading heavy components and dynamic imports for features not needed on initial load.

## Current State

| Category | Packages | Impact |
|----------|----------|--------|
| Animation | framer-motion | ~40KB gzipped |
| Export | docx, jspdf | ~60KB gzipped |
| Sync | yjs, y-webrtc, y-indexeddb | ~50KB gzipped |
| QR | qrcode.react | ~15KB gzipped |
| UI | @radix-ui/* (28 packages) | ~80KB gzipped (tree-shakeable) |

## Optimization Plan

### 1. Lazy-load heavy views (T1)

- Dynamic import for GraphView (sigma.js + graphology)
- Dynamic import for MindMapView (mind-elixir)
- Dynamic import for AIHarnessView (sync module)
- Dynamic import for ExportView (docx, jspdf)
- Dynamic import for SyncView (yjs, y-webrtc, qrcode)

### 2. Dynamic imports for sync module (T2)

- Lazy-load `src/lib/sync/` on first use
- Keep core Zustand store always loaded
- Load yjs providers only when user connects

### 3. Analyze and report (T3)

- Measure before/after bundle sizes
- Document optimization decisions
- Update PHASES.md

## Expected Results

- Initial bundle: ~150KB gzipped (down from ~250KB)
- Sync module: loaded on-demand (~50KB)
- Export module: loaded on-demand (~60KB)
