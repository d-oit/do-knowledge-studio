# Plan 160 — UI/UX, Design-Token & Harness Roast (2026-10-01)

Status: audit complete, findings filed as GitHub issues.
Scope: `src/app/globals.css`, `src/components/studio/**`, `src/lib/**` (visual layer),
`DESIGN.md`, `DESIGN-SYSTEM.md`, `agents-docs/`, `.agents/`, `.github/`, root agent configs,
and the in-app AI harness (`src/components/studio/views/ai-harness-*`, `src/lib/ai/`).

Method: three parallel review tracks (UI/UX roast, design-token audit, harness review),
every finding verified against live code (file:line) before filing. Zero open issues existed
at audit time.

## Executive summary

The bones are genuinely good: a working per-scope i18n message system, a real Overlay with
focus trap and scroll lock, `Intl` formatters in the right places, reduced-motion handling,
an announcer, and 109 compliant 44px touch targets prove the team knows the playbook. The
problem is **coverage and drift, not competence**:

1. **Docs and code tell two stories.** DESIGN-SYSTEM.md documents a saffron (`#c77d3a`) that
   no longer exists (`#9a5c2a` shipped); `layout.tsx`'s `themeColor` copied the stale doc
   value, so the browser chrome is tinted with a ghost of the old palette. AGENTS.md
   documents `data-theme` theming while next-themes uses a `.dark` class.
2. **The token layer leaks at every boundary.** 244 arbitrary `text-[Npx]` values beside an
   unused type scale; 109 hardcoded `44px` literals; entity-type metadata claiming
   `color: 'saffron'` while rendering raw `amber-*`; four TS files with bootleg hex palettes
   (export CSS twins, presence twins, mindmap fallback).
3. **Dark mode is second-class.** All elevation shadows are light-theme rgba with no `.dark`
   overrides; white text on `bg-saffron` drops to ~2.4:1 contrast in dark mode.
4. **A third of the custom CSS is dead.** Nine unused utilities (including `.glass`, which
   DESIGN.md explicitly bans), zero-referenced chart tokens, an orphaned `--header-bg`.
5. **A11y is one layer short of done.** Duplicate `<h1>`s on 4 of 11 views, a live region
   that stammers word counts per keystroke, `<tr role="link">` destroying table semantics,
   a half-built APG tablist, and sub-44px targets on the touch-only mobile drawer.
6. **The in-app AI harness ships two placebo features.** The custom model slug is displayed
   but never sent; suggestion chips set state and call `handleSend()` with a stale empty
   input — covered by a test that mocks away the guard that breaks it (LESSON-041).
7. **The repo harness is well-governed but decaying at the edges.** Catalogs omit the one
   skill AGENTS.md commands agents to load; HARNESS.md teaches a repealed 150-line ceiling;
   a Windows `Zone.Identifier` file is tracked in git; `.mimocode/` points at another repo.

## Issue map

### P1 — fix first
| Issue | Finding |
|---|---|
| Dark-mode saffron contrast (`--saffron-foreground` token) | UX-1 |
| AI harness custom model slug never sent | HAR-10 |
| AI harness suggestion chips cannot send (+ mocked test) | HAR-11 |
| Stale saffron in DESIGN-SYSTEM.md + `themeColor` ghost hex | TOK-1, TOK-2 |

### Design tokens
| Issue | Finding |
|---|---|
| Entity-type colors bypass bespoke tokens | TOK-8 |
| conflict-ui amber palette → semantic tokens | TOK-8 adj. |
| Dark-mode elevation: tokenize shadows | TOK-6 |
| Delete dead CSS utilities/tokens; wire header tokens | TOK-5, TOK-7, TOK-14, UX-15 |
| TS hex clusters → shared color module | TOK-9 |
| Type scale: missing steps + 244 arbitrary sizes | TOK-4 |
| `--spacing-touch` token for 109 literals | TOK-13 |
| sidebar.tsx `hsl(var())` invalid color | TOK-11 |
| `@utility` conversion + `.font-serif` cleanup | TOK-12 |
| Theming/radius doc drift | TOK-3, TOK-10 |

### UI/UX & a11y
| Issue | Finding |
|---|---|
| Duplicate `<h1>` on 4 views | UX-2 |
| Editor live region floods per keystroke | UX-3 |
| Mobile drawer touch targets < 44px | UX-4 |
| Shared ConfirmDialog; confirm Clear chat / Discard | UX-5 |
| Destructive hovers missing `dark:` variants | UX-6 |
| Library `<tr role="link">` semantics | UX-7 |
| Consolidate nav labels into i18n module | UX-8 |
| Deduplicate SearchPanel/SearchTab | UX-9 |
| Mind map Ctrl+Tab shortcut unreachable | UX-10 |
| Drawer tablist half-APG | UX-11 |
| Right panel width constant | UX-12 |
| Shared Intl date/time formatters | UX-13 |
| z-index scale + graph magic numbers | UX-14 |
| View chrome consistency + empty-state CTAs | UX-16 |
| Platform-aware ⌘K hint | new |
| System theme option + themeColor sync | new |

### Harness (repo)
| Issue | Finding |
|---|---|
| Skill catalogs stale + freshness gate | HAR-1 |
| HARNESS.md stale ceiling + agent table | HAR-2, HAR-6 |
| agents-docs/AGENTS.md registry drift | HAR-3 |
| Untrack OS junk + runtime state | HAR-4 |
| .mimocode orphan config | HAR-5 |
| SCRIPTS.md orphans + dead SKIP_CLIPPY | HAR-7 |
| skill-rules.json `.*` decoy | HAR-8 |
| goap-agent naming collision | HAR-9 |

### Harness (in-app AI)
| Issue | Finding |
|---|---|
| Streaming remount per token (React keys) | HAR-12 |
| aria-live floods during streaming | HAR-13 |
| Request timeout + Stop button | HAR-14 |
| Model/endpoint defaults dedupe | HAR-15 |
| Friendly provider error mapping | HAR-16 |

## Out of scope / follow-ups

- No code changes are made by this plan; each issue carries its own detailed fix.
- After the P1s land, re-run `scripts/quality_gate.sh` + e2e per the delivery lifecycle.
