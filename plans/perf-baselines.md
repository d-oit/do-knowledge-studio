# Performance Baselines

This document defines 3 reproducible benchmark flows for measuring application performance.
Use the in-app Performance Panel (Ctrl+Shift+P / Cmd+Shift+P in dev mode) to collect before/after numbers.

---

## Benchmark 1: App Bootstrap & First Shell Render

**What it measures:** Time from page load to the app being interactive (DB ready, first view rendered).

**Reproduction steps:**
1. Open Chrome DevTools → Network tab → Disable cache
2. Set CPU throttling to "4x slowdown" in Performance tab
3. Reload the page (hard reload: Ctrl+Shift+R)
4. Wait for "Booting Knowledge Studio..." to disappear
5. Note the `app-boot-time` measurement in the Performance Panel

**Metrics tracked:**
- `app-first-render`: Time from bootstrap start to first React render
- `app-boot-time`: Time from bootstrap start to DB ready + data loaded

**Acceptance criteria:**
- First shell renders in < 2s on cold load (no cache, 4x CPU throttling)
- Performance Panel shows non-null values for both metrics

---

## Benchmark 2: Search Latency (Keyword & Semantic)

**What it measures:** End-to-end time from typing a query to seeing results.

**Prerequisites:** At least 100 entities and 500 claims loaded in the database.

**Reproduction steps:**
1. Navigate to the Editor view
2. Open the search panel (click search icon or use keyboard shortcut)
3. Type a query of at least 3 characters (e.g., "knowledge")
4. Observe the `orama-query-time` measurement in the Performance Panel
5. Also note `search-first-result` (measured from search start to first results)
6. Repeat 3 times and take the average

**Metrics tracked:**
- `orama-query-time`: Orama search execution time (includes FTS)
- `search-first-result`: End-to-end search latency from UI

**Acceptance criteria:**
- Keyword search returns results in < 100ms for datasets up to 10k documents
- First result appears before full search completes (progressive rendering)
- Performance Panel shows measurements for each search

---

## Benchmark 3: Graph & Mind Map Rendering

**What it measures:** Time to initialize and render the graph visualization and mind map.

**Prerequisites:** At least 50 entities with interconnecting links.

### Graph View

**Reproduction steps:**
1. Navigate to the Graph view
2. Note the `graph-layout-finish` measurement in the Performance Panel
3. Toggle focus mode on a node with many connections
4. Observe `react:GraphView` Profiler entries (render durations)
5. Repeat navigation (Editor → Graph → Editor) and measure mount times

### Mind Map

**Reproduction steps:**
1. Navigate to the Mind Map view
2. Note the `mindmap-init` measurement in the Performance Panel
3. Change depth settings and note re-mount times
4. Observe `react:MindMapView` Profiler entries

**Metrics tracked:**
- `graph-layout-finish`: Sigma.js graph initialization time
- `react:GraphView`: React Profiler render duration for Graph component
- `mindmap-init`: Mind Elixir initialization time
- `react:MindMapView`: React Profiler render duration for Mind Map component

**Acceptance criteria:**
- Graph renders in < 500ms for 50 nodes
- Mind Map inits in < 300ms for 50 nodes at depth 2
- React Profiler shows both components as distinct Profiler entries

---

## Data Collection Method

All measurements are collected via the `src/lib/perf/index.ts` module which wraps the
native `performance.mark()` / `performance.measure()` API. In dev mode, measurements
are viewable in the floating Performance Panel (Ctrl+Shift+P).

To export raw data for analysis:
```js
// In DevTools console:
JSON.stringify(window.__PERF_ENTRIES__ || [])
```

The entries array is capped at 500 to avoid memory leaks.
