# 064 — Phase 8: Collaboration Planning (2026-07-16)

## Summary

Planning document for Phase 8 collaboration features. Breaks down the 30h+
initiative into 11 GitHub issues across 4 epics, tracked via Milestone #1.

## Epic 1: P2P Sync (Issues #450-454)

| Issue | Title | Effort | Dependencies |
|-------|-------|--------|-------------|
| #450 | ADR: P2P sync architecture | 2-3h | None (first) |
| #451 | Sync engine core — data model and delta sync | 6-8h | #450 |
| #452 | Device pairing — QR code flow | 4-5h | #451 |
| #453 | Network discovery — mDNS/WebRTC signaling | 4-6h | #451 |
| #454 | CRDT merge — conflict-free entity resolution | 6-8h | #450, #451 |

## Epic 2: Conflict Resolution (Issue #455)

| Issue | Title | Effort | Dependencies |
|-------|-------|--------|-------------|
| #455 | Conflict UI — manual merge for edge cases | 4-5h | #454 |

## Epic 3: Multi-User Presence (Issues #456-457)

| Issue | Title | Effort | Dependencies |
|-------|-------|--------|-------------|
| #456 | Multi-user presence — awareness protocol | 4-5h | #451 |
| #457 | Live cursors and selection indicators | 3-4h | #456 |

## Epic 4: Voice-to-Knowledge (Issues #458-459)

| Issue | Title | Effort | Dependencies |
|-------|-------|--------|-------------|
| #458 | Voice-to-knowledge — speech-to-text | 3-4h | None |
| #459 | Voice NLP — intent parsing for entities | 4-5h | #458 |

## Epic 5: Sync UI (Issue #460)

| Issue | Title | Effort | Dependencies |
|-------|-------|--------|-------------|
| #460 | Sync UI — status, history, and controls | 3-4h | #451 |

## Execution Order

```
Phase 8.1 (Foundation):
├── #450: ADR — sync architecture decision
├── #458: Voice-to-knowledge (independent, can parallel)
└── #459: Voice NLP (depends on #458)

Phase 8.2 (Core Sync):
├── #451: Sync engine core
├── #453: Network discovery (parallel with #451)
└── #460: Sync UI (parallel with #451)

Phase 8.3 (Merge & Pairing):
├── #454: CRDT merge
├── #452: Device pairing
└── #455: Conflict UI

Phase 8.4 (Presence):
├── #456: Multi-user presence
└── #457: Live cursors

Total estimated effort: 44-57 hours
```

## Milestone

- **GitHub Milestone**: [Phase 8: Collaboration](https://github.com/d-oit/do-knowledge-studio/milestone/1)
- **Issues**: #450-#460 (11 issues)

## Architecture Notes

Phase 8 must respect AGENTS.md hard rules:
- **Local-first only** — no required backend
- **Zustand + localStorage** — persistence layer (sync extends this)
- **No new required dependencies** — evaluate CRDT libs carefully

## ADR Required

Issue #450 must be completed first. Key decision:
- WebRTC for transport (browser-native, no server)
- CRDT vs custom merge strategy
- Signaling mechanism (QR code, manual, optional lightweight server)
