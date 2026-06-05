# Motion Guidelines

## Transitions

```css
/* Default for interactive elements */
transition: all 0.15s ease;

/* Color-only transitions */
transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
```

## Rules

- Hover state on every clickable element
- Focus visible on every interactive element
- Respect `prefers-reduced-motion`
- No animation for decoration only
- Loading spinners: use `animate-spin` from Lucide
- Modal enter: fade + scale (0.2s)
- Toast enter: slide up (0.3s)
