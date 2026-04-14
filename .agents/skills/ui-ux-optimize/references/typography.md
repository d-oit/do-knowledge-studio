# Typography Reference

## Roles

| Role | Purpose | Weight | Min Size |
|---|---|---|---|
| display | Page titles, hero | 700–900 | clamp(1.75rem, 5vw, 3rem) |
| heading | Section titles | 600–800 | 18px |
| body | Paragraphs | 400–500 | 16px |
| label | Tags, badges | 600–700 | 12px |
| mono | Counters, data | 400–600 | 14px |

## Wrapping Rules
- Card titles: max 2 lines, ellipsis
- Nav labels: never wrap — truncate or icon-only
- HUD text: single line, abbreviated forms
- Buttons: single line, flex prevents wrap

## Anti-Patterns
- No `white-space: nowrap` on body text
- No `font-size < 14px` for readable body on mobile
- No thin fonts (weight < 400) on dark backgrounds at small sizes

## Game Typography
- HUD minimum weight: 700 (readability under motion)
- XP/counters: always mono role
- Labels: tracking 0.04em for uppercase HUD labels
