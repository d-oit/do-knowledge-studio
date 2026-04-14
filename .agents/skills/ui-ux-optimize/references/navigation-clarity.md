# Navigation Clarity Reference

## Core: Navigation is a UX system, not a decorative header.

## Models

| Model | Use When | Rules |
|---|---|---|
| Bottom Tab Bar | 3–5 primary destinations, touch-first | 56–64px + safe area, icon+label, always visible |
| Hamburger | 6+ destinations | Must show home anchor without opening |
| Sidebar | Multi-level, dashboard | 240px, persistent on desktop, collapsible on tablet |
| Top Nav | Simple site, few destinations | All items visible, logo left |

## Game Navigation
- Quest/level list is the hub — not traditional main menu
- Bottom tab bar, 4 items max
- Active tab: color + indicator (accessibility)

## Label Rules
1. Specific over generic: "Quests" not "Tasks"
2. Single word preferred on mobile
3. Never truncate nav labels
4. Localization buffer: 30% text expansion

## Cross-Screen
- Every drill-down has a back path
- Modal: ESC/click-outside to dismiss
- Deep linking: any screen within 3 taps

## Anti-Patterns
- No hamburger for ≤5 destinations on mobile
- No wrapping nav items
- No hiding critical destinations under vague labels
- No dead-end screens
