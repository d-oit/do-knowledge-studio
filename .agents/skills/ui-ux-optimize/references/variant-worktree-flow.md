# Variant Worktree Flow Reference

## Types

**Default:** editorial (typography-forward), product (dense/scannable), expressive (bold personality)
**Game:** immersive (cinematic/serif), competitive (dense HUD), minimal-hud (clean/floating)

## Rules
1. All variants share: token architecture, navigation model, screen map
2. Variants differ: token values, composition density, visual personality
3. Each variant: token diff list, rationale, one-sentence summary
4. Max 3 variants (avoid decision paralysis)

## Output Format
```yaml
variant_plan:
  base_variant: editorial
  variants:
    - name: product
      rationale: Dense layout for power users
      token_overrides: ["gap 24px→12px", "radius.lg→base", "padding 16px→12px"]
      summary: Tighter density, harder edges, same IA
```

## Anti-Patterns
- Never change navigation model between variants
- Never add new token categories
- Never break responsive behavior
- Never create "dark mode" as a variant (it's a platform token)
