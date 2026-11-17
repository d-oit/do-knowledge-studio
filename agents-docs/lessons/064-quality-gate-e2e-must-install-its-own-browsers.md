## LESSON-064: The quality gate launches browsers it never installs — a cold cache fails every E2E spec in 2 ms

**Problem**: The `Quality Gate` job on `main` failed with all E2E specs erroring
almost instantly:

```text
Error: browserType.launch: Executable doesn't exist at
/home/runner/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell
```

The gate runs `pnpm run test:e2e` (all four projects, and `mobile`/`tablet` are
WebKit device descriptors) through `scripts/lib/language-checks.sh`, but only
the dedicated `E2E Tests` job runs `playwright install --with-deps chromium`
with an `actions/cache` step. The gate therefore depended on a warm
`~/.cache/ms-playwright`, and the job's first run had been cancelled and
rerun, so the cache was cold. The dedicated E2E job on the same commit passed.

**Solution**: Install the browsers as part of the gate, immediately before the
suite runs: `pnpm exec playwright install --with-deps chromium webkit` on
GitHub runners, `pnpm exec playwright install chromium webkit` locally.
Installation is idempotent — a no-op when the locked builds are present — so a
warm cache stays fast and a cold one becomes correct.

Reproduced and proven locally:

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-empty pnpm exec playwright test --project=chromium -g "page has a main landmark"
# Error: browserType.launch: Executable doesn't exist at /tmp/pw-empty/chromium_headless_shell-1248/...
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-empty pnpm exec playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-empty pnpm exec playwright test --project=chromium -g "page has a main landmark"
# 1 passed
```

**Prevention**:
- A CI cache is an optimization, never a dependency: any step that launches a
  browser must be able to provision it. A cancelled-and-rerun job is the usual
  way a cache goes cold, so "it passed yesterday" is not evidence.
- `playwright test` with no `--project` filter runs every project in
  `playwright.config.ts`; installing only Chromium breaks the WebKit
  `mobile`/`tablet` projects and the failure looks identical to a missing
  Chromium.
- Failure shape to recognise: every spec erroring in 2–3 ms with a launcher
  error means environment, not application. Twenty-four "passed" specs in the
  same run are the projects that still found a binary.

**Files Modified**:
- `scripts/lib/language-checks.sh` - install `chromium webkit` before `pnpm run test:e2e`
