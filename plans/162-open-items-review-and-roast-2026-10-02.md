# Plan 162 — Open Items Review & Roast (2026-10-02)

Status: **complete and landed**. Method: GOAP-orchestrated parallel swarm — 4
PR reviewers + 7 read-only issue verifiers — every verdict re-checked against
a clean `origin/main` worktree (`2ab8db0`, spot-checked on `08fe322` after
#891 landed mid-review). Roasts are the reviewers' words; evidence is
`file:line` on main or the PR diff.

Published via #902 (isolated docs PR; this file was session-local until then).
Final session state: all follow-up PRs merged (#893, #894, #896, #897, #898,
#900, #901), #899 merged, gate exemption approved and landed in #900, and the
open backlog is exactly the 24 verified issues below.

Scope: all 8 open PRs and 32 open issues. Main moved during the review
(dependabot merges + #891), which the report accounts for.

## Outcome

| Action | Items |
|---|---|
| **Merged** (fully clean, standing authorization) | #831, #832, #835, #833 (after branch update), #834 (after rebase — merged 18:27 UTC) |
| **Closed — corrupted branch** | #841 |
| **Closed — superseded by #891** | #889 — changes requested first; #891 landed the same fix with tests |
| **Merged — regression restoration (follow-up)** | #893 (tokens/docs/AI-harness/junk → `c6784a6`), then #894 (harness remainder + rename, stacked on #893 → `63c7990`) |
| **Merged — #843 unblocked** | Codacy false positive suppressed via Cloud CLI (`--ignore-issue 131544812672 --reason FalsePositive` + `--reanalyze`), GitNexus thread resolved, merged `fe1a8f7` |
| **Closed by concurrent #891 while the swarm ran** | 8 issues: #854, #857, #859, #860, #866, #868, #872, #874 |
| **Issues closed by this review** | **0 of 24** — every remaining issue was verified real on main; closing would have been unsupported |

Final state: 0 open PRs · 24 open issues (all re-verified today).

## ⚠→✅ Regression alert — #890 clobbered #888; fully remediated the same day

#890 ("feat(ux): improve search panel accessibility…", 46 files) was a
Jules-generated branch that counter-reverted #888's P1 fixes. As found on main
(`08fe322`), before remediation:

| Re-broken | Evidence on main |
|---|---|
| Closed #845 — white text on `bg-saffron` in dark mode (~2.4:1) | `--saffron-foreground` has **0 hits** in `src/`; 6 `bg-saffron text-white` sites (mobile-drawer, right-panel-citations, chat-subcomponents, library-view, ai-harness-provider-setup) |
| Closed #847 — doc/token drift | `DESIGN-SYSTEM.md` has 4 stale `#c77d3a` hits; `layout.tsx` themeColor `#c77d3a` vs shipped `#9a5c2a` |
| Closed #844 — custom model slug never reaches the provider | `ai-harness-view.tsx` computes `effectiveModel` **after** the hook and passes `model` (the #890 diff flips `model: effectiveModel` → `model`) |
| Closed #846 — suggestion chips silently abort | hook is back to `handleSend()` with `if (!input.trim()) return` reading state; chips do `setInput(prompt); await handleSend()` on the stale closure; the #890 test change mocks both setters, masking it (LESSON-041 pattern) |
| Closed #879/#881 — orphan config untracked | `.mimocode/` **6 files tracked again**; `.qwen/settings.json.orig` tracked again |
| Closed #876/#882 — harness freshness + rename | freshness-gate lines removed from `scripts/agent-surface.py` (−46), `scripts/generate-skills-docs.py` (−19), `tests/generate-skills-docs.bats` (−27); catalogs back to `goap-agent` |
| Plan-160 audit doc | deleted by #890 (recoverable at `2ab8db0^:plans/160-…md`) |

**Remediation — done, same day:** #893 (`378cde8` → squashed `c6784a6`)
restored the code regressions and junk untracking; #894 (`63c7990`, by the
cline bot, stacked on #893) restored the harness freshness gate and the
`goap-agent → goap-planning` rename. Verified on `63c7990`: 6
`saffron-foreground` hits in `src/`, `.mimocode/` 0 files tracked, `.jules/` 0,
all three ignore patterns back. Reinjection check: the restored #844/#846 tests
fail against the pre-fix sources and pass with the fix.

## PR verdicts

| PR | Verdict | Action | Roast |
|---|---|---|---|
| #841 perf(graph-layout) | **CLOSE** — branch tip deletes 10 files present at merge-base/main (`hydration-guard.ts`, `cross-tab-merge.ts`, `mindmap-export.ts`, graph-elements, editor preview/advanced fields, recovery e2e) and the "optimization" no longer exists (no early exit, `hasClearance` test-only, 2000 ms budget for a 15 ms op) | Closed with evidence comment | "Jules set out to optimize graph layout by five milliseconds and successfully 'optimized' ten critical files out of existence, including the codebase's hydration guard and cross-tab merge boundaries. To top it off, the final commit deleted its own early-exit logic and set a two-second timeout for an operation that already takes fifteen milliseconds." |
| #843 Codacy cleanup | **BLOCKED** — new critical Codacy finding introduced: `research.ts:225` SSRF after removing the inline `nosemgrep` (Opengrep can't taint-track `buildReaderRequestUrl`); BEHIND main | Open; restore the precise inline directive or documented suppression, rebase | "You set out to eliminate suppressions and fix Codacy at the source, only to delete the nosemgrep comment that was keeping Opengrep quiet and introduce a brand new critical security failure. To top it off, you deleted .mimocode just in time for main to merge PR #890 and bring the entire directory right back." |
| #889 platform-aware ⌘K (external) | **REQUEST_CHANGES** → then **CLOSE superseded** — #891 shipped `platform.ts` + `formatShortcut` + tests first | Review posted; closed with credit | "Copying a one-liner from an issue comment into module scope works wonders until Next.js SSR executes it in Node and hands your Mac users a hydration mismatch on their very first keystroke." |
| #831 @types/node | MERGE_NOW | Merged | "Updating types for a runtime you don't run in production is the spiritual equivalent of ironing your socks before going barefoot." |
| #832 dompurify | MERGE_NOW (patch security hardening; no CVEs listed) | Merged | "Three patch bumps just to ensure our sanitized HTML is marginally more paranoid than our sanitizer config." |
| #833 codeql-action | MERGE_AFTER_UPDATE | Updated + auto-merged | "A one-line patch bump to SARIF uploading that fell behind main because even Dependabot didn't care enough to rebase its own chore." |
| #834 transformers 4.3.0 | MERGE_NOW (pipeline/TextStreamer APIs unchanged; CI green) | Lockfile race → rebased → merged 18:27 UTC (`af55529`) | "A minor version bump that brings 500MB of WebGPU ambition to a feature ninety percent of users will run on an iPhone SE." |
| #835 radix tabs | MERGE_NOW | Merged | "Four patch releases deep to discover that tree-shaking tabs is easier than deciding which tab should actually be active." |

## Open issues — verified real on main (24)

All 24 remain open with verified, reproducible evidence; none had a valid close
ground (not fixed, not duplicated, not invalid).

| # | Sev | Verdict | Roast |
|---|---|---|---|
| 848 dead utilities/tokens museum | P2 | VALID | "The CSS museum is real: all nine custom utility plaques have zero visitors, while Tailwind's line-clamp replacements are already in use." |
| 849 conflict-ui amber palette | P2 | VALID (14 amber lines; no `--warning` token) | "Fourteen lines of amber later, the conflict warning still has no semantic token—just a very committed orange impersonation." |
| 850 dark-mode elevation | P2 | VALID (no `.dark` shadow overrides) | "The shadows are there in dark mode, technically; visually, they are whispering in almost the same color as the floor." |
| 851 entity-type colors | P2 | VALID (metadata says saffron/sage/clay/sky; renders amber/emerald/rose/sky) | "The metadata calls the colors saffron, sage, clay, and sky; the rendered badges then take an unsupervised trip through amber, emerald, rose, and Tailwind sky." |
| 852 44px literals | P3 | VALID (~110 literals; no token) | "One hundred ten literal touch-size lines—and still no touch token—turn a one-character regression into a well-stocked museum." |
| 853 TS hex palettes | P2 | **PARTIAL** — stale hexes real; "same 12-color palette" overstates (cursors duplicates 8) | "The exports still wear stale ink and saffron; meanwhile the alleged 12-color copy is an eight-color prefix—this twin was counted before it finished dressing." |
| 855 type scale bypass | P2 | VALID (237 non-test literals; two `text-[8px]`) | "The scale says use tokens; the app keeps 237 exceptions, and the issue's 244 still can't agree with its own 245-count histogram." |
| 856 editor live region | P2 | VALID | "This is a keyboard-to-screen-reader hot mic: every changed character updates the atomic live region, with the draft status trapped in the same broadcast." |
| 858 @layer utilities | P3 | VALID (no `@utility`; duplicate `.font-serif`) | "Tailwind's theme already issues a `font-serif` utility, then the stylesheet prints another; `@layer` groups CSS but doesn't enroll custom classes in the variant registry." |
| 861 library `tr role=link` | P2 | VALID | "The row keeps its click and keyboard handlers but swaps its table-row semantics for link cosplay, then labels the whole thing 'Open X'." |
| 862 drawer touch targets | P2 | VALID (23–36px vs 44px floor; post-#890) | "A touch-only drawer shouldn't need a microscope: its four cited controls range from about 23px to 36px against the project's 44px floor." |
| 863 destructive actions unconfirmed | P2 | VALID (clearChat/discard direct; no shared ConfirmDialog) | "Deleting an entity gets a warning, while clearing a whole research transcript and deleting an autosaved draft get one click each. The confirmation policy has apparently mistaken blast radius for a sorting algorithm." |
| 864 SearchPanel/SearchTab clones | P2 | **PARTIAL** — #890 added list/a11y parity on both sides; drift (ranked rows, empty-state action, i18n, targets, announcements) remains | "The two panels share a feature name, then disagree about ranked rows, empty-state actions, announcements, translations, and target size. #890 improved some search-list accessibility; it did not merge the twins or teach the mobile one the desktop's keyboard and clear controls." |
| 865 nav labels triple-mapped | P2 | VALID (46 of 50 map fields literal) | "Three navigation maps encode the same views, and the timeline is the sole localization escape hatch in each. The 19-module i18n system is present; the navigation maps seem to have missed the invitation." |
| 867 drawer fake tablist | P3 | VALID | "These buttons announce the vocabulary of the full tabs pattern while implementing only its labels and selected state. The missing panel and arrow-key behavior are doing a lot of silent work." |
| 869 z-layers + graph magic numbers | P3 | VALID | "The graph file does know its canvas size, but its circular center and radius still use fixed coordinates; elsewhere the z-stack is three unrelated stairs and the palette has its own tape measure." |
| 870 view chrome patchwork | P3 | VALID | "There are four view-local hero headings in an eleven-view router, but Export still gets its page title from the shared Topbar, and the canvases do have a global New entity escape hatch. Their empty-state copy just forgot the contextual invitation." |
| 871 Intl date formatting | P3 | VALID (undercounts: HomeView also pins en-US) | "The locale census missed a resident: HomeView also pins `en-US`. The Library gets the user's locale; the inspector and editor get a very confident passport stamp." |
| 873 system theme | P3 | VALID (`enableSystem={false}`) | "The toggle offers only Light and Dark; the operating system is invited to set the browser chrome, but not the app theme." |
| 883 streaming keystroke remount | P2 | VALID (content-keyed rows) | "Here, every new sentence is a new React identity, while two identical sentences are apparently the same person." |
| 884 raw provider errors | P3 | VALID (200-char body in bubble; no console.error) | "The provider body is clipped to 200 characters, then pasted straight into the assistant bubble; clipping is not friendly error copy, and the diagnostic log stays silent." |
| 885 no timeout/Stop | P2 | VALID | "An AbortController exists, but the interface gives the user no hand on the handle; a hung request gets neither a deadline nor a Stop button." |
| 886 model defaults ×4 | P2 | VALID (drifted catalogs, 4th copy in endpoint helper) | "There are multiple homes for `openrouter/free`, and the two model catalogs cannot agree on Claude; even the duplicate endpoint helper has outlived its production callers." |
| 887 aria-live transcript | P2 | VALID | "`aria-atomic=false` avoids promising a full-transcript replay, not the per-delta narration: the live region still wraps every message and the typing indicator." |

## Issues fixed by #891 while the swarm was verifying (8) — already closed

These were verified real first; #891 (merged `08fe322`) fixed each and GitHub
closed them.

| # | Fix in #891 |
|---|---|
| 854 | sidebar rail shadow now uses the hex var directly |
| 857 | AGENTS.md `.dark`-class wording + DESIGN.md radius table (6/8/10/14/16px) |
| 859 | duplicate in-view `<h1>` demoted to `<h2>` on Sync/AI/TRIZ/Timeline |
| 860 | destructive hovers now use `--destructive` |
| 866 | mind-map add-child rebound `Ctrl+Tab` → `Ctrl/Cmd+Enter` |
| 868 | one `PANEL_WIDTH_CLASS`; Library no longer flaps |
| 872 | `platform.ts` `formatShortcut` wired into topbar/sidebar/dialog |
| 874 | static "Offline ready" pills removed |

Roasts for the record: "The docs have the DOM hook wrong and the radius scale
two pixels out of step" (#857) · "The topbar already owns the page-level H1;
four views then nominate a second one" (#859) · "Discard and Leave briefly
repaint dark mode with a pale red wash… these two buttons just missed the
memo" (#860) · "the issue's 244 still can't agree with its own 245-count
histogram" (#855, still open) · "the UI advertises a shortcut that depends on
the browser never intercepting its tab switcher" (#866) · "The panel has a
20px mood swing" (#868) · "'Offline ready' is not the opposite of 'You are
offline,' so 'contradicts' overstates it; still, a static capability pill
beside the live connectivity banner makes two different signals share one
topic" (#874).

## Follow-ups

1. **Done — regression restored**: #893 (code + hygiene) and #894 (harness
   remainder) merged the same day; see the remediation note above.
2. **#872's landed fix (#891) carries the SSR hazard that got #889 rejected** —
   `IS_MAC_PLATFORM` is module-scope `navigator.platform`; on macOS the server
   renders `Ctrl+K` and the client hydrates `⌘K` — a text mismatch on the
   topbar/sidebar `<kbd>`s. `platform.test.ts` runs in jsdom, so it can't catch
   it. The hydration-safe shape already exists in the WIP branch: plans/161's
   `src/lib/studio/use-reduced-motion.ts` was rewritten to
   `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` precisely
   for this class of bug (main still reads `matchMedia` on first render). Wrap
   `formatShortcut` in the same shape (`usePlatformShortcut()`; server snapshot
   = non-mac) — the WIP `e2e/hydration-mismatch.spec.ts` can pin it.
3. **#843** — inline `nosemgrep` alone does not clear Codacy Cloud (the pre-#843
   form was equally inert): Opengrep cannot track the taint through
   `buildReaderRequestUrl`, and the finding was re-flagged at the new sink
   (`research.ts:229`, pattern `Semgrep_rules_lgpl_javascript_ssrf_rule-node-ssrf`)
   after the refactor deleted the comment. Resolved the documented way: verified
   false positive (scheme + private-IP guard, percent-encoded to a fixed
   `JINA_READER_ENDPOINT` host), suppressed via the Codacy Cloud CLI —
   `--ignore-issue 131544812672 --ignore-reason FalsePositive` — then
   `--reanalyze`. Review pass over the final diff (`gh pr diff 843` — the PR's
   three-dot surface, 13 files; at review time main was `63c7990`): no
   P1/P2; the `MIGRATIONS.slice` dispatch is equivalent (future-version payloads
   are rejected by the upstream guard and covered by `migrations.test.ts`);
   two new dialog-guard tests added. Merged `fe1a8f7` on 2026-10-02 after
   resolving the GitNexus docs-wording thread; remote + local branches deleted.
4. Optional: group the remaining 24 issues into themed fix tracks (tokens
   #848–#858, a11y #861–#867, UX #869–#874, AI harness #883–#887) — close each
   only when its fix lands; all 24 were re-verified real, so closing to clear
   the backlog would contradict the evidence.
5. Comment-only follow-up from the GitNexus thread on #843: reword
   `buildReaderRequestUrl`'s docblock — it rejects *literal* private/reserved
   host forms, not DNS-resolved hosts (no lookup is performed; the sink is the
   fixed Jina host). No behavior change. — Done in #896.

## Post-plan session record (2026-10-03)

### #900 — platform pin completion (merged `c8f72ef`)
Two-part pin on main: the SSR `renderToString` case pins the **server-snapshot
contract only** (rejects render-time direct reads: a wrong `getServerSnapshot`,
or `useState(() => read navigator)` — reinjection-verified); the lazy-re-read
case (stub macOS *after* the module's import, assert a client render flips to
mac) rejects the import-time captured-const shape (#891). Both red-checks were
executed. #897's and #895's bodies were edited post-merge to correct their
overclaims.

### #899 — Zip-Slip guard (merged `0d67ac1`); review-record correction
Jules branch rebased onto main; the out-of-scope audit-gate hunks
(`--ignore-unfixable` + `pnpm.auditConfig`) were dropped in favor of main's
approved narrow flag, and a rebase casualty (workflow file truncated to 10
lines) repaired. **Correction to my chat summary:** the "adversarial
hardening" claim was overstated — Jules's implementation already had
`if (safeSegments.length === 0) return null`; my edit only added a comment
explaining it. The `//etc/passwd` case is **not** separator-only and still
returns `etc/passwd` (leading-slash roots normalize away, drive-letter paths
survive). The shipped behavior (all root forms collapse to relative paths,
never rejected) is acceptable because the map keys are consumed by
`parseOkfBundle` as plain strings — no filesystem write uses them — but the
comment-only change shipped without a test pinning it, and the "27/27 tests"
figure included a deleted scratch file.

### #901 — LOC-ceiling compliance for #899 (merged `57d8526`)
`use-export-handlers.test.ts` was at 506 lines pre-#899 and 535 after
(AGENTS 500-line ceiling). The `sanitizeZipPath` suite moved to
`use-export-handlers-sanitize.test.ts`; the hook suite is restored
byte-identical to its pre-#899 state (verified empty diff vs `0d67ac1~1`).
The suite also pins the root-normalizing behavior, including the known gap
below. GitNexus review surfaced a real contract gap, recorded here as a
follow-up: **a drive-rooted zip entry survives as `C:/Windows/evil.md`, and
`buildEntity` derives the entity id `C:/Windows/evil`, violating the
bundle-relative path contract (`okf/types.ts` §2)**. Zip Slip rejection is the
sanitizer's job and works; bundle-relative validation belongs in
`parseOkfBundle`/§2 — reject drive-rooted and absolute names there, with a
test.

## Swarm roster (11 agents)

Pr841 · Pr843 · Pr889 · PrDeps (reviewers) | IssuesHarnessAI (#883–887) ·
IssuesThemeI18n (#857/#871–873) · IssuesTokensA (#848–852) · IssuesTokensB
(#853–858) · IssuesA11yA (#856/#859/#861–862) · IssuesA11yB (#863–867) ·
IssuesUxC (#860/#868–870/#874). Verdict taxonomy and evidence standard:
`/tmp/roast/CONTEXT.md`.
