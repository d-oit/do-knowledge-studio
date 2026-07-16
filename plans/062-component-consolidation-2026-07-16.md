# 062 — Component Consolidation (2026-07-16)

## Summary

Extract shared Button, FieldLabel, TextInput, Divider, ToolbarBtn, and
ToggleButtonGroup primitives to reduce duplication across views. Audit found
25+ button occurrences, 12 input occurrences, 8 label occurrences, and 3
identical Divider components.

## Task Dependency Graph

```
Wave 0 (Foundation — new primitives, no deps)
├── T0.1: Button component with variants (primary, secondary, ghost, danger, icon)
├── T0.2: FieldLabel component (uppercase tracking label)
├── T0.3: TextInput + SelectInput components
├── T0.4: Divider component (toolbar divider)
├── T0.5: ToolbarBtn component (icon+label toolbar button)
└── T0.6: ToggleButtonGroup container

Wave 1 (Refactor views to use new primitives — depends on Wave 0)
├── T1.1: Refactor ai-harness-view.tsx
├── T1.2: Refactor library-view.tsx
├── T1.3: Refactor editor-view.tsx + editor-toolbar.tsx
├── T1.4: Refactor export-view.tsx
├── T1.5: Refactor graph-view.tsx + mindmap-view.tsx
└── T1.6: Refactor chat-view.tsx + triz-view.tsx

Wave 2 (Quality gate — depends on Wave 1)
└── T2.1: Tests + lint + typecheck + build + e2e
```

## Constraints

- Named exports only
- No new dependencies
- Max 500 LOC per file
- All existing behavior must be preserved
- All CI must pass
