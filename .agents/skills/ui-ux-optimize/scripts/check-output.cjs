#!/usr/bin/env node
/**
 * UI/UX Optimize — Eval assertion engine.
 *
 * Validates skill output against contains / not_contains expectations.
 * Used by the eval runner to verify code-generating skills produce correct output.
 *
 * Usage:
 *   const { runAssertion } = require('./check-output.cjs');
 *   const result = runAssertion(output, { contains: ['foo'], not_contains: ['bar'] });
 */

/**
 * @param {string} output - The skill's generated output (HTML/JSX/markdown).
 * @param {{contains?: string[], not_contains?: string[]}} expectations
 * @returns {{passed: boolean, failures: string[]}}
 */
function runAssertion(output, expectations) {
  const results = { passed: true, failures: [] };

  if (expectations.contains) {
    for (const term of expectations.contains) {
      if (!output.includes(term)) {
        results.passed = false;
        results.failures.push(`Missing expected term: ${term}`);
      }
    }
  }

  if (expectations.not_contains) {
    for (const term of expectations.not_contains) {
      // For CSS class names, match whole tokens (whitespace, quotes, or string boundaries).
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[\\s"'])${escaped}([\\s"']|$)`);
      if (regex.test(output)) {
        results.passed = false;
        results.failures.push(`Found forbidden term: ${term}`);
      }
    }
  }

  return results;
}

// CLI mode: read expectations from stdin or file
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node check-output.cjs <output-file> <expectations-json>');
    process.exit(1);
  }

  const output = fs.readFileSync(args[0], 'utf8');
  const expectations = JSON.parse(fs.readFileSync(args[1], 'utf8'));
  const result = runAssertion(output, expectations);

  if (result.passed) {
    console.log('✅ PASSED');
    process.exit(0);
  } else {
    console.log('❌ FAILED');
    for (const f of result.failures) console.log(`   - ${f}`);
    process.exit(1);
  }
}

module.exports = { runAssertion };
