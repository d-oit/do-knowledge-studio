# Plan 153 — The E2E Harness Could Not Prove Its Server Was Up, and Kept No Evidence (2026-09-24)

**Type**: CI harness defect + diagnosability
**Scope**: `playwright.config.ts`, `.github/workflows/ci-and-labels.yml`,
`src/lib/__tests__/e2e-harness.test.ts` (new)
**Follows**: the E2E failure on PR #817 (transient, unexplained)

## 1. What happened

PR #817's E2E job ran 149 tests against the dev server and **140 failed**, all of
them on the same readiness wait:

```
Error: expect(locator).toBeAttached() failed
Locator: locator('[data-app-ready="true"]')
> 20 |   await expect(page.locator('[data-app-ready="true"]')).toBeAttached();
```

Only the contrast tests — which do no page load — passed. The run took 14.6
minutes instead of ~3. Re-running the same job on the same commit **passed**, so
the trigger was environmental rather than a code regression. But it was not
diagnosable, and that is the defect this plan fixes:

1. **Readiness was a bound port, not a served response.** `webServer.port: 3000`
   is satisfied the moment `next dev` binds, while it is still compiling. Tests
   began 3 seconds after the server started. If the server cannot answer yet, every
   test that navigates fails on its own 5-second readiness wait — a wall of
   failures that looks like 140 broken tests.
2. **The failure left no evidence.** The job uploaded `playwright-report/` on
   failure, but the config's `reporter: 'list'` never creates that directory, so
   the upload had nothing to send. Meanwhile `trace: 'on-first-retry'` was
   collecting traces into `test-results/`, which no step uploaded. The failed
   run's artifacts contain only the coverage report — there was no trace, no error
   context, and no server log to explain what the server was doing.

## 2. Change

**`playwright.config.ts`**

| Setting | Before | After | Why |
|---|---|---|---|
| `webServer` readiness | `port: 3000` | `url: 'http://localhost:3000'` | Wait for a real response; a server that never becomes healthy is now one clear timeout instead of a wall of test failures |
| `webServer.timeout` | default (60 s) | `120000` | Covers a cold `next dev` compile on a slow runner |
| `webServer.stdout` / `stderr` | default | `'pipe'` | The server's own output appears in the job log |
| `reporter` | `'list'` | CI: `[['list'], ['html', { open: 'never' }]]` | Creates the `playwright-report/` directory the workflow uploads |

**`ci-and-labels.yml`** — the failure upload now covers both directories and is
renamed to match what it actually carries:

```yaml
      - name: Upload Playwright artifacts
        if: failure()
        with:
          name: playwright-artifacts
          path: |
            playwright-report/
            test-results/
          if-no-files-found: warn
```

## 3. Verification

`src/lib/__tests__/e2e-harness.test.ts` loads the real config (with `CI` stubbed,
since the reporter depends on it) and the real workflow, and asserts the contract
above. Each assertion was mutation-checked:

| Mutation | Result |
|---|---|
| `url` → `port: 3000` | `waits for a served response, not a bound port` fails |
| drop `test-results/` from the upload path | `uploads the traces alongside the report` fails |
| `reporter` → `'list'` in CI | `writes the HTML report in CI` fails |
| restored | 6/6 pass |

`pnpm exec playwright test e2e/home.spec.ts e2e/graph-density.spec.ts
--project=chromium` — 10 passed, so the config still parses and drives a real run.

**The cold-start path itself is verified by the next CI run**, which is where the
failure happened: it starts `pnpm run dev` itself and now must see a served
response before the first test begins.

**Confirmed on `main`** (dispatch run
[`36048842590`](https://github.com/d-oit/do-knowledge-studio/actions/runs/36048842590)):
the E2E job spent **85 seconds** between installing the browsers and starting the
first test — the readiness wait for `next dev` to answer — where the failing run
had started tests 3 seconds after the server bound. The sweep then ran
`604 tests`, `600 passed`, in 9.9 min.

## 4. What this does not fix

The underlying stall is unexplained — with the dev server answering HTTP while
serving pages that lack `<main>`, the most likely shape is a degraded runner or a
stalled `next dev`. This plan makes that shape visible (server log, traces, one
readiness timeout) rather than guessing at it now. If it recurs, the artifacts
from that run will name the cause.

## 5. Follow-ups

1. **Watch the next E2E failure for the new artifacts** — `playwright-artifacts`
   should contain `test-results/` with traces.
2. **Consider a production server for E2E** (`pnpm run build && pnpm run start`):
   no on-demand compilation, and closer to production. Deliberately not done here:
   it changes what every E2E test runs against, which deserves its own change and
   a full four-project validation.
