#!/usr/bin/env node
/**
 * UI/UX Optimize — Token validation pre-check.
 *
 * Fast-fail filesystem validation that runs before expensive browser verification.
 * Checks that persistent design docs and code design system exist and are aligned.
 *
 * Exit 0 = pass, Exit 1 = fail.
 */

const fs = require('fs');
const path = require('path');

const docsDesignSystemPath = path.join(process.cwd(), 'docs', 'design', 'design-system.md');
const codeDesignSystemPath = path.join(process.cwd(), 'src', 'lib', 'design-system.tsx');

let hasError = false;

// Check persistent docs
if (!fs.existsSync(docsDesignSystemPath)) {
  console.error('❌ Validation failed: docs/design/design-system.md not found.');
  console.error('   Run Step 2 (Token Architect) of the UI/UX Optimize skill first.');
  hasError = true;
}

// Check code design system
if (!fs.existsSync(codeDesignSystemPath)) {
  console.error('❌ Validation failed: src/lib/design-system.tsx not found.');
  console.error('   The Token Architect must generate the code design system before verification.');
  hasError = true;
} else {
  const content = fs.readFileSync(codeDesignSystemPath, 'utf8');
  // The file should export a TOKENS object or use semantic token references
  const hasTokensExport = content.includes('export const TOKENS') ||
    content.includes('export { TOKENS }') ||
    content.includes('export default TOKENS');

  if (!hasTokensExport) {
    console.error('❌ Validation failed: No TOKENS export found in design-system.tsx.');
    console.error('   Expected: export const TOKENS = { ... }');
    hasError = true;
  }
}

// Check session files if they should exist
const sessionMd = path.join(process.cwd(), 'ui-ux-session.md');
const sessionJsonl = path.join(process.cwd(), 'ui-ux-session.jsonl');

if (fs.existsSync(sessionMd) && !fs.existsSync(sessionJsonl)) {
  console.warn('⚠️  Warning: ui-ux-session.md exists but ui-ux-session.jsonl is missing.');
  console.warn('   Session log may be incomplete.');
}

if (hasError) {
  process.exit(1);
}

console.log('✅ Token validation passed: design docs and TOKENS export are present.');
process.exit(0);
