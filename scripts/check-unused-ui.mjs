#!/usr/bin/env node
/**
 * Advisory unused-UI check (#1063).
 *
 * Lists files in `src/components/ui` never imported by `src/`. Exits 0 always
 * (advisory in CI); the report is for cleanup, not a gate, because some
 * primitives are kept deliberately for future use.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const uiDir = join(root, 'src', 'components', 'ui');
if (!existsSync(uiDir)) {
  console.log('No src/components/ui directory — nothing to audit.');
  process.exit(0);
}
const files = readdirSync(uiDir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
const PATTERN = 'components/ui/[A-Za-z0-9_-]+';
let grep = '';
try {
  grep = execSync(`grep -rhoE "${PATTERN}" src --include="*.ts" --include="*.tsx" || true`, {
    encoding: 'utf8',
  });
} catch (error) {
  console.error('Unused UI check: import scan failed; treating all primitives as used.', error);
  process.exit(0);
}
const unused = files.filter((f) => {
  const base = f.replace(/\.(tsx|ts)$/, '');
  return !grep.includes(`ui/${base}`);
});
if (unused.length === 0) {
  console.log('Unused UI check: no unused primitives found.');
} else {
  console.log(`Unused UI check (advisory): ${unused.length} file(s) with no imports:`);
  for (const f of unused) console.log(` - src/components/ui/${f}`);
  console.log('Kept deliberately unless a cleanup PR removes them with passing tests.');
}
