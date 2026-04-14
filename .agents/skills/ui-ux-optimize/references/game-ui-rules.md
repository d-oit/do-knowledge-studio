# Game UI Rules Reference

## Play Context

| Context | HUD Density | Examples |
|---|---|---|
| casual | Low | Match-3, idle, casual RPG |
| competitive | High | FPS, MOBA, fighting |
| narrative | Medium | RPG, adventure |
| simulation | High | City builder |
| puzzle | Minimal | Sudoku, Tetris |

## HUD Rules
1. Scope explicitly: HUD only on in-quest screens
2. Safe zones: `top: env()+12px`, `bottom: env()+20px`
3. Layers: base(100), feedback(150), modal(200)
4. Background: semi-transparent `rgba(base, 0.80)`
5. Font weight: minimum 700
6. Thumb-reach: primary actions in bottom 50%

## HUD Tokens
```
hud.bg, hud.text, hud.accent, hud.target.min: 52px
hud.safe.top/bottom, hud.layer.base/modal/feedback
```

## Menu Flow
```
App → Hub (quest list) → Feature screens → In-session HUD → Pause → Return
```

## Overlays
- One overlay at a time
- Backdrop blocks interaction
- Focus trapped inside
- ESC/back dismisses

## Anti-Patterns
- No generic "epic" fonts without justification
- No 3-column grid on mobile for games
- No thin fonts (<600) in HUD
- No auto-advance after completion
- No HUD on non-gameplay screens
