# Review Checklist Reference

## Scoring

| Section | Max | Checks |
|---|---|---|
| Anti-Slop | 5 | No banned words, no hollow phrases, translations complete |
| Token Compliance | 9 | Semantic names, 4px grid, roles defined, variants inherit |
| Navigation Quality | 8 | Model defined, items named, active states, back paths |
| Layout Safety | 8 | No overlap, padding ≥16px, truncation defined, CTA offset correct |
| Responsive Behavior | 4 | PASS at 375/768/1024/1440, no horizontal scroll |
| Typography Clarity | 6 | 5 roles defined, body ≥16px, no vague descriptors |
| Color Restraint | 5 | Semantic roles, contrast ≥4.5:1, ≤3 accents |
| Accessibility Baseline | 5 | Tap targets ≥44px, focus ring, color not sole indicator |
| Implementation Readiness | 7 | Specific enough, deliverables listed, tokens included |
| Game-Specific | 9 | Play context, HUD positions, safe zones, overlay discipline |

## Effective Scoring

The **Game-Specific** section applies only to game products. For non-game products, score the remaining 9 sections.

| Product Type | Max Score | Sections | Pass Threshold (91%) | Perfect |
|---|---|---|---|---|
| Game | 66 | All 10 | 60 | 66 |
| Non-game | 57 | 9 (skip Game-Specific) | 52 | 57 |

**Always report both `score` and `max_applicable`.** Use effective percentage for keep/revert decisions:
```
effective = score / max_applicable
keep if effective ≥ 0.91 AND confidence ≥ 2.0×
```
