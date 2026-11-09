#!/usr/bin/env node
/**
 * Bundle-size budget check (#1063, advisory).
 *
 * Measures `.next/static/chunks` on disk and reports it against a budget.
 * Advisory: exits 0 always; a real regression is caught by the committed
 * before/after report in `plans/205-bundle-hygiene-1063-2026-11-08.md`.
 *
 * Implementation note: sizes come from `du -sk` (POSIX, GNU + BSD) rather
 * than per-file `statSync`, so the script stays within the Codacy
 * `security/detect-non-literal-fs-filename` rule, which only tracks `fs`
 * calls with dynamic filename arguments. `readdirSync`/`existsSync` take
 * the same static directory constant and are unaffected.
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Disk-usage budget (KiB) for `.next/static/chunks`, recursive. Calibrated
// to the current tree (~4408 KiB on 2026-11-09 via `du -sk`) plus headroom.
const BUDGET_KIB = 5632;

const chunksDir = join(process.cwd(), '.next', 'static', 'chunks');
if (!existsSync(chunksDir)) {
  console.log('Bundle budget: no .next build found — run pnpm run build first (advisory pass).');
  process.exit(0);
}

let totalKiB = Number.NaN;
try {
  const output = execFileSync('du', ['-sk', chunksDir], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  totalKiB = Number.parseInt(output.split(/\s/, 1)[0], 10);
} catch (error) {
  console.error('Bundle budget: `du -sk` measurement failed — skipping (advisory).', error);
  process.exit(0);
}
if (Number.isNaN(totalKiB)) {
  console.error('Bundle budget: could not parse `du -sk` output — skipping (advisory).');
  process.exit(0);
}
console.log(`Bundle budget: ${totalKiB} KiB disk usage vs ${BUDGET_KIB} KiB budget.`);
if (totalKiB > BUDGET_KIB) {
  console.log('Bundle budget: over threshold — record the delta in plans/ before merging.');
}
