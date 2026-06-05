# Color Reference

## Design Tokens

Use CSS custom properties from `src/styles/index.css`:

```css
--text-primary       /* Main text color */
--text-secondary     /* Secondary text */
--text-muted         /* De-emphasized text */
--background-primary /* Main background */
--background-secondary /* Card/panel background */
--border-default     /* Standard borders */
--interactive-primary /* Primary action color */
--status-success     /* Success states */
--status-danger      /* Error/danger states */
```

## Rules

- No `#000` or `#fff` — use tinted neutrals
- 4.5:1 contrast minimum for body text
- 3:1 contrast minimum for large text / UI components
- Status colors must include icon or text, not color alone
- Test with `data-theme="game"`, `data-theme="neural"`, `data-theme="technical"` for theme compatibility
