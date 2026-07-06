# Motion Guidelines

## Duration Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--motion-fast` | 100ms ease-out | Micro-interactions, hover |
| `--motion-base` | 200ms ease-in-out | Standard transitions |
| `--motion-slow` | 300ms ease-in-out | Page transitions, modals |

## Transitions

```css
/* Default for interactive elements */
transition: all var(--motion-fast);

/* Color-only transitions */
transition: color var(--motion-fast), background-color var(--motion-fast), border-color var(--motion-fast);
```

## Rules

- Hover state on every clickable element
- Focus visible on every interactive element
- Respect `prefers-reduced-motion`
- No animation for decoration only
- Loading spinners: use `animate-spin` from Lucide
- Modal enter: fade + scale (0.2s)
- Toast enter: slide up (0.3s)
- Use `ease-out` for entrances, `ease-in` for exits
- Keep animations subtle and fast
