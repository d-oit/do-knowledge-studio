# Auto-Research Reference

## Purpose

Before generating any design output, research current domain trends, platform guidelines, and competitor patterns. Prevents stale, generic output and grounds design decisions in real-world conventions.

## Search Strategy

### Round 1: Domain Trends (2 min)
**Query:** `"[product type] UI design trends [current year]"`

Extract: navigation conventions, component patterns, typography/color trends, interaction patterns.

### Round 2: Platform Guidelines (2 min)
**Query:** `"[platform] design system guidelines [current year]"`

Extract: platform-specific spacing/type/color, navigation patterns, accessibility requirements.

### Round 3: Anti-Patterns (1 min)
**Query:** `"[product type] UX anti-patterns"`

Extract: common failures, accessibility pitfalls specific to domain.

## Source Evaluation

| Priority | Source | Action |
|---|---|---|
| High | Official platform docs (Apple, Google) | Apply directly |
| High | Design system docs (Stripe, Linear, Figma) | Reference as precedent |
| Medium | Expert blogs, NNGroup, Baymard | Inform decisions |
| Never | AI-generated blogs, aggregators | Skip |

## Output Format

```yaml
research_context:
  domain: "<product type>"
  search_queries: [{query, results_summary}]
  domain_trends: ["<trend with source>"]
  platform_guidelines: ["<guideline>"]
  anti_patterns_detected: ["<anti-pattern>"]
  precedent_products: [{name, pattern, url}]
  token_influence: ["<how research affected tokens>"]
  navigation_influence: ["<how research affected nav>"]
```

## Quality Rules
1. Never cite sources older than 18 months for trends
2. Always include current year in search queries
3. Prefer 2 focused searches over 5 broad ones
4. If game, research game-specific UI patterns only
