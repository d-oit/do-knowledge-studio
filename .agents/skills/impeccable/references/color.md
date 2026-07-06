# Color Reference

## Design Tokens

Use CSS custom properties from `src/styles/tokens.css`:

```css
/* Surfaces */
--bg-base           /* Page background */
--bg-surface        /* Card/panel background */
--bg-elevated       /* Popovers, modals */
--bg-active         /* Selected states */
--bg-hover          /* Hover states */

/* Text */
--text-primary      /* Main text color */
--text-secondary    /* Secondary text */
--text-muted        /* De-emphasized text */
--text-inverse      /* Text on colored backgrounds */

/* Interaction */
--interactive-primary       /* Primary action color (teal) */
--interactive-primary-subtle /* Subtle primary background */
--interactive-hover         /* Hover state */
--interactive-active        /* Active/pressed state */

/* Status */
--status-success    /* Success states */
--status-warning    /* Warning states */
--status-danger     /* Error/danger states */
--status-info       /* Informational states */

/* Status backgrounds */
--status-success-bg
--status-warning-bg
--status-danger-bg
--status-info-bg

/* Borders */
--border-default    /* Standard borders */
--border-subtle     /* Lighter borders */
--border-focus      /* Focus ring color */
--border-error      /* Error border */
```

## Theme System

Two themes via `data-theme` attribute on `<html>`:

| Theme | Character | Accent |
|-------|-----------|--------|
| `light` | Clean, professional | `#00b894` teal |
| `dark` | High-contrast dark | `#00d9a3` bright teal |

## Rules

- No `#000` or `#fff` — use tinted neutrals
- 4.5:1 contrast minimum for body text
- 3:1 contrast minimum for large text / UI components
- Status colors must include icon or text, not color alone
- Test with `data-theme="light"` and `data-theme="dark"` for theme compatibility
- Never hardcode hex values in components — use tokens
