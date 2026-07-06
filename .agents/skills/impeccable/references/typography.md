# Typography Reference

## Font Stack

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

## Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--size-xxs` | 10px | Captions, badges |
| `--size-xs` | 11px | Labels, metadata |
| `--size-sm` | 12px | Secondary text, code |
| `--size-base` | 13px | Small UI text |
| `--size-md` | 14px | Button text, inputs |
| `--size-body` | 15px | Body text (default) |
| `--size-lg` | 17px | h4, emphasized text |
| `--size-xl` | 20px | h3 |
| `--size-2xl` | 24px | h2 |
| `--size-3xl` | 30px | h1 |
| `--size-heading` | 1.25rem | Section headings |
| `--size-display` | clamp(1.5rem, 5vw, 2.5rem) | Hero/display text |

## Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--weight-normal` | 400 | Body text |
| `--weight-medium` | 500 | Labels, emphasis |
| `--weight-semibold` | 600 | Headings, buttons |
| `--weight-bold` | 700 | h1, strong emphasis |

## Rules

- Never use `font-weight: 300` below 16px
- Minimum 10px for any visible text (`--size-xxs`)
- Code: use `--font-mono` only for actual code blocks
- Truncate with ellipsis: `text-overflow: ellipsis; white-space: nowrap; overflow: hidden`
- Input/select MUST stay at `font-size: 16px` (prevents iOS auto-zoom)
- Use `clamp()` for responsive heading sizes when possible
