# Browser Verification Reference

## When to Run
After Step 6 (layout audit), before Step 7 (anti-slop), when: fixed/absolute elements present, game HUD, responsive breakpoint shifts, overlap risks flagged.

## Workflow
1. Generate reference HTML from optimized prompt
2. Screenshot at 375px, 768px, 1024px, 1440px
3. Check overlap (critical pairs, not all-vs-all), nav wrapping, tap targets (≥44px), horizontal scroll
4. If FAIL → revise prompt, re-run verification

## Critical Pairs
HUD vs nav, HUD vs fixed CTA, nav vs fixed CTA, nav vs card, XP card vs nav.

## Screenshot Review
**Mobile (375px):** Nav not cut off, CTA visible, padding present, readable text, no h-scroll.
**Tablet (768px):** Layout shift correct, no orphans, spacing increased.
**Desktop (1024px):** Full nav visible, content constrained.
**Wide (1440px):** Max-width behavior, intentional whitespace.

## Output
```yaml
browser_verification:
  screenshots: [paths]
  overlap_issues: [list or none]
  nav_wrap_failures: [list or none]
  tap_target_failures: [list or none]
  overall: PASS | FAIL
```
