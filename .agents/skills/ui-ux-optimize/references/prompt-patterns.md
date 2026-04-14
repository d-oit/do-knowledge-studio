# Prompt Patterns Reference

## Weak-to-Strong Rewrites

**Vague → Specific:** "Make it look modern" → "Inter 400 16px body, 4px radius, single accent #2563eb, 24px section spacing"

**Adjective → Token:** "Fun, playful" → "Nunito 900 display, radius.xl 16px, amber #f59e0b, spring animations"

**Generic → Domain:** "Dashboard with metrics" → "4 stat cards: mono 600 32px, label 13px, sparkline. Grid 2col mobile/4col desktop"

**Layout → Composition:** "Responsive" → "375px: single col 16px padding bottom nav. 768px: 2-col minmax(280px) sidebar. 1024px: 3-col + 240px sidebar"

**Accessibility → Measurable:** "Accessible" → "text.primary on bg.base ≥7:1. Tap targets ≥44px. Focus ring 2px solid border.focus"

## Output Schema
```
PRODUCT: [type] with [feature]
TARGET USER: [audience], [platform], [context]
DESIGN DNA: [3-5 sentences through specific tokens]
TOKENS: [summary]
NAVIGATION: [model, items, states]
SCREEN: [name] Layout: [grid/flex] [components]
RESPONSIVE: [breakpoint]: [behavior]
ANTI-PATTERNS: [specific list]
DELIVERABLES: [artifacts]
```
