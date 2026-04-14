# Self-Learning Loop Reference

## Capture
After every run: what improved, what confused, what harmed.

## Format
```yaml
lessons_learned:
  run_id: string
  product_type: string
  what_improved: [string]
  what_caused_confusion: [string]
  what_harmed_clarity: [string]
  improvement_rules:
    - rule: string
      trigger: string
      category: translation|layout|game-ui|navigation|token|anti-slop|research
      priority: high|medium|low
```

## When to Create a Rule
- Same issue in 2+ runs
- Specific technique consistently improves output
- Translation should become standard

## Application
Before new run: check prior lessons for same product type, apply matching rules, avoid prior mistakes.

## Log Format
Append to `ui-ux-session.jsonl` (one JSON line per iteration) and `ui-ux-session.md` (readable summary).
