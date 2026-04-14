# Layout Composition Reference

## Core Principles
1. Container-based layout — flow within containers, not absolute positioning
2. Grid/flex first — CSS Grid 2D, Flexbox 1D
3. Content defines height — never fix heights for text
4. Spacing defines rhythm — token spacing, not magic numbers

## Patterns

**Single Column (mobile):** Full-width cards, 16px padding, vertical stacking with `component.gap`.
**Two Column (tablet):** Sidebar 240px + `auto-fill minmax(280px, 1fr)` grid.
**Three+ Column (desktop):** Max-width container (1200–1440px) centered, optional aside panel.

## Overlap Prevention
1. Never `position: absolute` for primary layout
2. Fixed elements must reserve space (padding-bottom = fixed height)
3. Fixed CTA + bottom nav: `calc(nav-height + safe-area-bottom + gap)`
4. HUD must be transparent, not block content interaction

## Critical Pairs
HUD vs nav, HUD vs fixed CTA, nav vs fixed CTA, nav vs card, toast vs HUD.

## Density

| Type | Card Gap | Padding |
|---|---|---|
| Content | 24px | 16/24px |
| Dashboard | 16px | 16px |
| Game (casual) | 24px | 16px |
| Game (competitive) | 12px | 12px |

## Overflow
- Card titles: 2-line clamp, ellipsis
- Nav labels: 1-line, ellipsis
- Body: natural wrap
- Horizontal: `overflow-x: hidden` on page
