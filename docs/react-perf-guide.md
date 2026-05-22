# React Performance Guide

## Overview

This document captures findings from the React Profiler audit and provides team guidance for writing performant React 19 code in this codebase.

## Profiler Findings

### Hot Components with Repeated Rerenders

| Component | Issue | Fix Applied |
|-----------|-------|-------------|
| `Editor` | Inline `onChange` handlers recreated on every render causing child input rerenders | Moved to `useCallback` with stable refs |
| `Editor` | `ENTITY_TYPES` array recreated on each render | Moved to module-level constant |
| `Editor` | `handleSave` recreated every render | Wrapped in `useCallback` with proper deps |
| `MindMapView` | `treeData` recalculation on every entity/link change | Added JSON stringify comparison guard |
| `MindMapView` | Full MindElixir instance recreation on every prop change | Guarded with `treeDataRef` comparison |
| `App` | `refreshData` called immediately on boot | Deferred via `requestIdleCallback` |

### Audit Notes

1. **Context boundaries**: `DbProvider` context has a stable shape. Adding a memoization wrapper is unnecessary since only `dbReady`/`error` change once during startup.
2. **Prop stability**: All `onResultClick`, `setCurrentView`, etc. are already wrapped in `useCallback` ✅
3. **React Compiler**: This codebase uses React 19 and the React Compiler could be evaluated. However, given the local-first SQLite architecture, the overhead of memoization is negligible compared to DB query latency. Focusing on effect boundaries is more impactful.
4. **Derived data**: Prefer `useMemo` over effect-driven sync. The `treeData` computation in `MindMapView` was already using `useMemo` ✅

## Best Practices for This Codebase

### 1. Move Static Data Outside Components

```typescript
// ❌ Bad: Recreated every render
const MyComponent = () => {
  const OPTIONS = ['a', 'b', 'c'];
  return <Select options={OPTIONS} />;
};

// ✅ Good: Module-level constant
const OPTIONS = ['a', 'b', 'c'];
const MyComponent = () => <Select options={OPTIONS} />;
```

### 2. Use `useCallback` for Handlers

```typescript
// ❌ Bad: New function every render
const MyComponent = () => (
  <input onChange={e => setValue(e.target.value)} />
);

// ✅ Good: Stable callback reference
const MyComponent = () => {
  const handleChange = useCallback((e) => setValue(e.target.value), []);
  return <input onChange={handleChange} />;
};
```

### 3. Guard Expensive Reinitializations

```typescript
// ✅ Good: Compare before reinitializing
const instanceRef = useRef<string>('');
useEffect(() => {
  const json = JSON.stringify(data);
  if (instanceRef.current === json) return;
  instanceRef.current = json;
  // expensive work
}, [data]);
```

### 4. Defer Non-Critical Work

```typescript
// ✅ Good: Use requestIdleCallback for deferrable work
useEffect(() => {
  requestIdleCallback(() => {
    performHeavyOperation();
  }, { timeout: 1000 });
}, []);
```

### 5. Narrow Context Providers

Avoid putting frequently-changing values in context that cause widespread rerenders. Prefer passing props to specific components.

### 6. Prefer Derived Data Over Effect-Driven Sync

```typescript
// ✅ Good: Derived state via useMemo
const filteredItems = useMemo(() =>
  items.filter(i => i.active),
  [items]
);

// ❌ Avoid: Effect-driven sync
useEffect(() => {
  setFiltered(items.filter(i => i.active));
}, [items]);
```

## Profiling Checklist

- [ ] Are all event handlers wrapped in `useCallback`?
- [ ] Are static arrays/objects defined outside components?
- [ ] Are expensive data computations in `useMemo`?
- [ ] Are reinitialization effects guarded with comparison?
- [ ] Is non-critical work deferred to idle callbacks?
- [ ] Are context providers providing stable references?
- [ ] Are there any effect chains that could be simplified?

## Performance Budget

| Metric | Target |
|--------|--------|
| Boot to interactive | < 2s |
| Search query response | < 100ms (keyword) |
| Graph render (50 nodes) | < 500ms |
| Mind map init (50 nodes) | < 300ms |
| Editor mount | < 200ms |
| Single rerender (any component) | < 16ms |
