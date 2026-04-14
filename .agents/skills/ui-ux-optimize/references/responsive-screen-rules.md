# Responsive Screen Rules Reference

## Required Breakpoints

| Name | Width | Height |
|---|---|---|
| mobile-375 | 375px | 812px |
| tablet-768 | 768px | 1024px |
| desktop-1024 | 1024px | 768px |
| wide-1440 | 1440px | 900px |

## Per-Breakpoint Rules

**Mobile (375–430px):** Single column, bottom tab nav, 16px padding, tap targets ≥44px, no horizontal scroll.
**Tablet (768px):** 2-column grid (`auto-fill minmax(280px,1fr)`), sidebar replaces bottom nav, 24px padding.
**Desktop (1024px):** 3+ column or sidebar+content, persistent sidebar, max-width 1200px centered.
**Wide (1440px):** Max-width container, generous whitespace, no edge-to-edge stretch.

## No-Overlap Validation
Check critical pairs at every viewport using bounding box overlap:
```python
def boxes_overlap(a, b):
    return (a['x'] < b['x'] + b['width'] and a['x'] + a['width'] > b['x'] and
            a['y'] < b['y'] + b['height'] and a['y'] + a['height'] > b['y'])
```

## Safe Area
```css
padding-bottom: env(safe-area-inset-bottom, 0px);
/* Fixed bottom elements: */
bottom: calc(nav-height + env(safe-area-inset-bottom, 0px) + gap);
```
