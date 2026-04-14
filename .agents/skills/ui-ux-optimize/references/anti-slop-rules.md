# Anti-Slop Rules Reference

## Banned Adjectives → Translate To

| Word | Translate To |
|---|---|
| "fun" | radius.xl, Nunito 900, amber accent |
| "clean" | generous whitespace, limited palette, 1px borders |
| "modern" | specific precedent font, not Inter by default |
| "professional" | muted palette, strict grid, conservative radius |
| "playful" | radius 16px+, rounded font, warm colors, spring anim |
| "minimal" | reduced tokens, single accent, 8px+ spacing |
| "bold" | large display type, high contrast, thick borders |
| "premium" | elevation tokens, serif display, gold/dark palette |
| "not corporate" | no Inter, no blue, no neutral gray defaults |
| "generic" | exclusion list (no default fonts, no default palette, no default grid) + reference specific precedent product |
| "boring" | spring animations for completion, human-voiced empty states, one display font with character, celebration micro-interactions |

## Banned UX Phrases

| Phrase | Replacement |
|---|---|
| "Intuitive navigation" | Define: bottom tab/sidebar/top nav, items, states |
| "Seamless experience" | Define: transition tokens, loading states |
| "User-friendly" | Define: tap sizes, contrast, font sizes |
| "Responsive design" | Define: per-breakpoint behavior |
| "Accessible" | Define: contrast ratios, focus rings, ARIA |

## Banned Layout Clichés
- Three-column feature grid → content-appropriate grid
- Purple-blue gradient hero → semantic color roles
- Glassmorphism cards → elevated surface with shadow
- "Get started for free" → specific CTA
- Inter/DM Sans/Space Grotesk → intentional font choice

## Audit Checklist
- [ ] No banned adjectives remain
- [ ] All taste words → token values
- [ ] `anti_slop_warnings` lists every translation
- [ ] CTA text is specific
