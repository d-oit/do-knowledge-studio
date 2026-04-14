# Color System Reference

## Semantic Roles

- `bg.base/surface/elevated/overlay` — backgrounds
- `text.primary/secondary/muted/inverse` — text
- `interactive.primary/secondary/hover/active/disabled` — actions
- `status.success/warning/danger/info` — status
- `border.default/focus/error` — structural

## Contrast Rules

| Combination | Ratio |
|---|---|
| text.primary on bg.base | 7:1 (AAA) |
| text.secondary on bg.surface | 4.5:1 (AA) |
| interactive.primary on bg.surface | 4.5:1 |

## Restraint
1. Max 3 accent colors (or named roles for games)
2. Use opacity variants for hover/focus
3. Status colors must pair with icons/text (never color-only)
4. No rainbow gradients without justification
5. No pure black on pure white — use #1a1a2e / #f8f9fa
