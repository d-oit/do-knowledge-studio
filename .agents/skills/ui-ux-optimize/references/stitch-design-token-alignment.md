# Stitch Design Token Alignment Reference

## Design-First Workflow
1. Define token DNA before any layout/component work
2. Normalize: dot notation `category.role.variant`, semantic over raw
3. Map tokens to components: `card.padding: space.4`, `card.radius: radius.lg`

## Token Architecture
```
tokens/
├── global/       # spacing, typography, colors, radius, elevation, motion
├── semantic/     # bg, text, interactive, status, border aliases
├── component/    # card, nav, button, modal, hud
└── platform/     # mobile, tablet, desktop overrides
```

## Normalization Rules
1. No orphan values — every style traces to a token
2. No raw hex in components
3. No magic numbers — all on scale
4. Variant inheritance — override only what differs
5. Platform branching — responsive via platform tokens

## Variant Diffs
Document only overrides:
```yaml
variant: compact-rpg
token_overrides:
  type.size.heading: 18px → 15px
  space.component.gap: 24px → 16px
  radius.lg: 16px → 8px
```
