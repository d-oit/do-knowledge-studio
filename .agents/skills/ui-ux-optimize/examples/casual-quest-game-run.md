# Sample Run — Casual Quest Game

**Input:** "Design a mobile casual web game UI with a task/quest system. Fun, not corporate."
**Run ID:** `casual-quest-game-2026-04-01`

## Swarm Execution

### Research Scout (Step 0)
- Searched: "casual mobile game UI trends 2026", "iOS game interface guidelines", "mobile game UX anti-patterns"
- Found: Bottom tab dominant, warm palettes trending, Nunito popular, 52px tap targets
- Precedents: Genshin Impact (warm palette, quest cards), Stardew Valley (casual density)

### Anti-Slop Sentinel (Step 1)
- "fun" → radius.xl, Nunito 900, amber accent, XP bar animations
- "not corporate" → no Inter/blue/neutral-gray defaults; warm palette; game tokens only

### Token Architect (Step 2)
- Spacing: 4px base, interactive.min: 52px
- Typography: Nunito 900/800/400/700, JetBrains Mono 600
- Colors: bg.base #1a1128, interactive.primary #f59e0b (amber), interactive.secondary #a855f7

### Layout Engineer (Step 3)
- Nav: bottom tab, 4 items (Quests/Map/Inventory/Profile), 64px
- Screens: Quest List (hub), Quest Detail, Map, Inventory, Profile, Pause, Quest Complete overlay

### Variant Generator (Step 5)
- editorial (base), compact-rpg (tighter), immersive (serif+gold+darker)

### Browser Verifier (Step 6a)
- 5 screenshots, 0 overlap, 0 nav wrap, 0 tap target fails → PASS

### Quality Auditor (Step 8)
- Score: 66/66, Confidence: 3.2× → KEEP

### Lessons (Step 9)
- Auto-research validated design direction via competitor precedents
- Exclusion list ("not corporate") more effective than positive instructions
- HUD must be scoped explicitly to in-quest screens

## Session Files

**ui-ux-session.md:** Objective, product context, iteration log, key wins, current best.
**ui-ux-session.jsonl:** `{"run_id":"casual-quest-game-2026-04-01","iteration":1,"score":66,"confidence":3.2,"kept":true,"approach":"editorial"}`
