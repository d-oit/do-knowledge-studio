# Design Tokens Reference

## Token Categories

### Spacing
Base unit: 4px grid. All spacing values must be multiples of the base.

```
space.1: 4px | space.2: 8px | space.3: 12px | space.4: 16px | space.6: 24px
space.8: 32px | space.10: 40px | space.12: 48px | space.16: 64px
```

Semantic: `content.padding`, `component.gap`, `section.gap`, `nav.height.bottom`, `interactive.min` (≥44px, ≥52px games)

### Typography
Define by role with: font-family, weight, size, line-height, tracking.

```
display: <family> <weight>, clamp(min, preferred, max), leading <value>, tracking <value>
heading: <family> <weight>, <size>, leading <value>
body:    <family> <weight>, <size>, leading <value>
label:   <family> <weight>, <size>, tracking <value>
mono:    <family> <weight>, <size>, leading <value>
```

Rules: Body ≥16px mobile, HUD text ≥weight 700, Display can use clamp() for fluid sizing.

### Color
Semantic roles only. Never raw hex in component code.

```
bg.base | bg.surface | bg.elevated | bg.overlay
text.primary | text.secondary | text.muted | text.inverse
interactive.primary | interactive.secondary | interactive.hover | interactive.disabled
status.success | status.warning | status.danger | status.info
border.default | border.focus | border.error
```

### Radius
```
sm: 4px | base: 8px | md: 12px | lg: 16px | xl: 24px | full: 9999px
```

### Elevation
```
xs: 0 1px 2px rgba(0,0,0,0.05) | sm: 0 2px 8px rgba(0,0,0,0.1)
md: 0 4px 16px rgba(0,0,0,0.15) | lg: 0 8px 32px rgba(0,0,0,0.2)
```

### Motion
```
fast: 100ms ease-out | base: 200ms ease-in-out | slow: 350ms ease-out
spring: cubic-bezier(0.34,1.56,0.64,1)
```

## Naming: `category.role.variant`. Semantic over raw. Game tokens use `hud.*` prefix.

## Validation
1. All spacing on 4px grid. 2. No raw hex in components. 3. Colors pass 4.5:1 contrast. 4. Interactive targets ≥44px. 5. Typography includes family/weight/size/leading.
