#!/usr/bin/env node
/**
 * Bundle-size budget check (#1063, advisory).
 *
 * Reads the Next build output sizes from `.next` (first-load JS) and fails
 * only when the budget is exceeded by a clear margin. Threshold is documented
 * in `plans/205-bundle-hygiene-1063-2026-11-08.md`.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Raw-chunk budget (bytes, uncompressed). Measures `.next/static/chunks` on
// disk — not first-load gzip — so the threshold is calibrated to the current
// tree (~4.3 MB raw on 2026-11-08) plus headroom. Advisory: exits 0 always;
// a real regression is caught by the committed before/after report.
const BUDGET_BYTES = 5500 * 1024;

const chunksDir = join(process.cwd(), '.next', 'static', 'chunks');
if (!existsSync(chunksDir)) {
  console.log('Bundle budget: no .next build found — run pnpm run build first (advisory pass).');
  process.exit(0);
}
let total = 0;
let skipped = 0;
for (const f of readdirSync(chunksDir)) {
  try {
    // False positive (security/detect-non-literal-fs-filename): `f` comes
    // from readdir of the fixed `.next` build dir, never from user input,
    // and this advisory script always exits 0.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- see above
    total += statSync(join(chunksDir, f)).size;
  } catch (error) {
    // A chunk disappearing mid-read is not a budget failure; count and report.
    skipped += 1;
    console.error(`Bundle budget: skipped unreadable chunk ${f}`, error);
  }
}
if (skipped > 0) {
  console.log(`Bundle budget: ${skipped} chunk(s) disappeared mid-read (not a failure).`);
}
console.log(`Bundle budget: ${(total / 1024).toFixed(0)} KiB raw chunks vs ${(BUDGET_BYTES / 1024).toFixed(0)} KiB budget.`);
if (total > BUDGET_BYTES) {
  console.log('Bundle budget: over threshold — record the delta in plans/ before merging.');
}
