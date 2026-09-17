# Plan 141 — DeepSource Cleanup: Root Cause of the "Metric-Level Failure" + 36 Findings Triaged (2026-09-17)

**Type**: static-analysis remediation + root-cause record
**Scope**: `.deepsource.toml`, 16 source files under `src/`
**Follows**: plans/140 §3 item 2, plans/138 §5.3
**Tooling**: `deepsource` CLI v2.0.55 (`deepsource` skill)

## 1. Root cause: the check is not failing — it is skipped

plans/138 §5.3 recorded *"DeepSource: JavaScript still reports failure at the
metric level while every posted finding is `isOutdated` or `skip = true`"*.
Queried directly with the CLI:

| Query | Result |
|---|---|
| `deepsource runs` | newest run is `ca0bed6` — 2026-09-12T13:53Z, **SUCCESS**, grade A. No run exists for any later commit. |
| GitHub check on `6fbcb6f`, `ae48518`, PR #789, PR #790 | `completed` / **`skipped`**, output: **"Analysis quota is exhausted."** |
| `deepsource report-card` | A / 100 for security, reliability, complexity and hygiene |
| `deepsource issues --default-branch` | 1184 open occurrences |

The check does not fail — **the account's analysis quota is exhausted**, so
DeepSource skips every head since 2026-09-12. That is an account-level condition:
it clears on the billing cycle reset or with a plan change, and no repository
change can alter it. This supersedes the plans/138 §5.3 note.

## 2. Findings triage

Of the 1184 open occurrences, **794 sit in paths already excluded** by
`exclude_patterns` (`.agents/` 707, `scripts/` 85) or were opened before the
existing suppressions — all stale-open, and they clear on the next analysis.
**390 are in live paths** (`src/`, `e2e/`); 354 of those already carry a
`skip = true` pattern.

36 findings had codes with no suppression yet: **3 stale** (files deleted since
the analysis), **26 fixed in code**, **7 suppressed with rationale**.

### 2.1 Fixed in code (26)

| Code | n | Change |
|---|---|---|
| JS-0246 | 6 | string concatenation → template literals |
| JS-0066 | 4 | `!!x` → `Boolean(x)` |
| JS-0240 | 3 | shorthand property/method syntax (incl. a generator method) |
| JS-0357 | 3 | declarations moved above their first use (`copiedTimerRef`, `FormItemContext`) |
| JS-0320 | 2 | `delete obj[key]` → `Reflect.deleteProperty(obj, key)` |
| JS-R1004 | 2 | useless template literals → plain strings |
| JS-W1042 | 2 | dropped trailing `undefined` arguments |
| JS-0400 | 1 | `showPass={true}` → `showPass` |
| JS-0437 | 1 | conflict list now keys on its stable `entityId:field` key |
| JS-0757 | 1 | command palette focuses its input via ref + effect instead of `autoFocus` |
| JS-0105 | 1 | `OpenRouterAdapter.resolveTarget` extracted to module-level `resolveOpenRouterTarget` |

Two of these needed care rather than a mechanical rewrite:

- **JS-W1042 / `useRef`** — `@types/react@19` has no zero-argument `useRef`
  overload, so the argument cannot simply be dropped. `triz-view` now uses
  `useRef<… | null>(null)` with an explicit `!== null` guard before
  `clearTimeout`; `use-mobile` uses `useState<boolean>()`, which does have a
  zero-argument overload.
- **JS-0757 / focus** — `autoFocus` is replaced by a `commandOpen`-keyed effect
  that focuses a ref, preserving behaviour; `e2e/command-palette.spec.ts`
  asserts "search input is focused when opened" and covers the change in CI.

### 2.2 Suppressed in config (7)

| Code | n | Rationale |
|---|---|---|
| JS-0047 | 2 | Exhaustive switches over discriminated unions (`Action`, `AIProvider`). A `default` clause would turn "new union member" from a compile error into a silent fallthrough. |
| JS-0087 | 1 | The only occurrence is the deliberate unsafe-URL fixture in `src/lib/studio/schema.test.ts`, which asserts `javascript:`/`data:` schemes are **rejected**. Suppressing beats obfuscating a security test's literal. |
| JS-0105 | 3 | The methods implement the `ProviderAdapter` interface (`send`, `sendStream`) or mock a platform class (`MockBroadcastChannel`) — they must stay instance methods. |
| JS-0437 | 1 | The citation list is an immutable, ordered projection of one search result set where the ordinal **is** the citation number shown to the user. The true positive in the same rule was fixed in code (§2.1). |

## 3. Verification

| Check | Result |
|---|---|
| `pnpm run typecheck` | clean |
| `pnpm run lint` | clean, 0 warnings |
| `pnpm test` | 168 files, 2576 passed / 1 skipped |
| `./scripts/quality_gate.sh` | ✓ all gates passed, 0 warnings |
| `.deepsource.toml` parse | valid TOML; 15 skip patterns, 8 exclude patterns |
| DeepSource re-analysis | **cannot be verified** — quota exhausted (§1). Config and code changes take effect on the next successful analysis run. |

## 4. Follow-ups

1. **DeepSource quota** — account-level. Until it resets (or the plan changes),
   every DeepSource check stays `skipped`, the 794 stale-open occurrences remain
   listed, and none of §2 can be confirmed by the service. This is the one item
   that needs the maintainer, not the repo.
2. **Four deferred review findings** — plans/137 §5.
3. **ESLint 10** — blocked upstream, plans/140 §2.
