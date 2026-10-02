# Plan 160 — UI/UX, Design-Token & Harness Roast (2026-10-01)

Status: audit complete, findings filed as GitHub issues (#844–#887).
Scope note (2026-10-01): "harness" = the coding-workflow harness (agents-docs,
.agents, scripts, hooks) — NOT the in-app AI Harness product feature. In-app
AI harness issues (#883–#887, #884–#886) remain filed as verified defects but
are outside the requested scope.

## Implementation progress (branch cline/1h6wfzk7)

| Commit | Issue | Notes |
|---|---|---|
| d2ec25b | #846 | suggestion chips: handleSend(overrideInput); fail-first test rewritten against the real hook |
| 95bd9e5 | #844 | custom slug reaches provider: effectiveModel computed before the hook; view test drove full flow (red: openrouter/free → green: openai/gpt-5) |
| eb70e66 | #845 | --saffron-foreground token (light #fff / dark #14110d) at all 6 bg-saffron text sites |
| 62adedd | #847 | DESIGN-SYSTEM saffron table + button recipe + layout themeColor match globals.css |
| 9024a28 | #876 | catalogs regenerated (57 skills, verify-before-asserting visible); --check gate in agent-surface validate; BATS coverage |
| 73f7ecd, 9c7b7f8 | #882 | skill renamed goap-agent → goap-planning; sub-agents keep goap-agent |
| 6cedaa8 | #875, #877, #880 | HARNESS ceiling+agent table, registry ownership/rows, SCRIPTS catalog |
| 6bdaba7 | #878 | skill-rules.json ".*" pattern removed; advisory _note |
| e967afc | #881 | Zone.Identifier/.orig/.jules untracked + gitignored |
| 99b69d2 | #879 | .mimocode/ deleted (foreign config) |
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

## Issue map (filed 2026-10-01, #844–#887)

### P1 — fix first
| Issue | Finding |
|---|---|
| #845 Dark-mode saffron contrast (`--saffron-foreground` token) | UX-1 |
| #844 AI harness custom model slug never sent | HAR-10 |
| #846 AI harness suggestion chips cannot send (+ mocked test) | HAR-11 |
| #847 Stale saffron in DESIGN-SYSTEM.md + `themeColor` ghost hex | TOK-1, TOK-2 |
| #876 Skill catalogs omit verify-before-asserting + freshness gate | HAR-1 |

### Design tokens
| Issue | Finding |
|---|---|
| #851 Entity-type colors bypass bespoke tokens | TOK-8 |
| #849 conflict-ui amber palette → semantic warning tokens | TOK-8 adj. |
| #850 Dark-mode elevation: tokenize shadows | TOK-6 |
| #848 Delete dead CSS utilities/tokens; wire header tokens | TOK-5, TOK-7, TOK-14, UX-15 |
| #853 TS hex clusters → shared color module | TOK-9 |
| #855 Type scale: missing steps + 244 arbitrary sizes | TOK-4 |
| #852 `--spacing-touch` token for 109 literals | TOK-13 |
| #854 sidebar.tsx `hsl(var())` invalid color | TOK-11 |
| #858 `@utility` conversion + `.font-serif` cleanup | TOK-12 |
| #857 Theming/radius doc drift | TOK-3, TOK-10 |

### UI/UX & a11y
| Issue | Finding |
|---|---|
| #859 Duplicate `<h1>` on 4 views | UX-2 |
| #856 Editor live region floods per keystroke | UX-3 |
| #862 Mobile drawer touch targets < 44px | UX-4 |
| #863 Shared ConfirmDialog; confirm Clear chat / Discard | UX-5 |
| #860 Destructive hovers missing `dark:` variants | UX-6 |
| #861 Library `<tr role="link">` semantics | UX-7 |
| #865 Consolidate nav labels into i18n module | UX-8 |
| #864 Deduplicate SearchPanel/SearchTab | UX-9 |
| #866 Mind map Ctrl+Tab shortcut unreachable | UX-10 |
| #867 Drawer tablist half-APG | UX-11 |
| #868 Right panel width constant | UX-12 |
| #871 Shared Intl date/time formatters | UX-13 |
| #869 z-index scale + graph magic numbers | UX-14 |
| #870 View chrome consistency + empty-state CTAs | UX-16 |
| #872 Platform-aware ⌘K hint | new |
| #874 Static "Offline ready" badge vs real banner | new |
| #873 System theme option + themeColor sync | new |

### Harness (repo)
| Issue | Finding |
|---|---|
| #875 HARNESS.md stale ceiling + agent table | HAR-2, HAR-6 |
| #877 agents-docs/AGENTS.md registry drift | HAR-3 |
| #881 Untrack OS junk + runtime state | HAR-4 |
| #879 .mimocode orphan config | HAR-5 |
| #880 SCRIPTS.md orphans + dead SKIP_CLIPPY | HAR-7 |
| #878 skill-rules.json `.*` decoy | HAR-8 |
| #882 goap-agent naming collision | HAR-9 |

### Harness (in-app AI)
| Issue | Finding |
|---|---|
| #883 Streaming remount per token (React keys) | HAR-12 |
| #887 aria-live floods during streaming | HAR-13 |
| #885 Request timeout + Stop button | HAR-14 |
| #886 Model/endpoint defaults dedupe | HAR-15 |
| #884 Friendly provider error mapping | HAR-16 |

## Out of scope / follow-ups

- No code changes are made by this plan; each issue carries its own detailed fix.
- After the P1s land, re-run `scripts/quality_gate.sh` + e2e per the delivery lifecycle.
