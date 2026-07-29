import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Standard WCAG 2.0/2.1 AA tags */
const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/** WCAG 2.2 AA adds 2.2-specific rules */
const WCAG_22_AA_TAGS = [...WCAG_AA_TAGS, 'wcag22aa'] as const;

/** Impact levels that should fail the test, ordered by severity */
const BLOCKING_IMPACTS = ['critical', 'serious'] as const;

/**
 * Strict axe-core assertion: fails on any critical OR serious violation.
 * Uses WCAG 2.0/2.1/2.2 AA tags.
 *
 * Use this for comprehensive accessibility verification.
 */
export async function assertNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_22_AA_TAGS])
    .analyze();

  const blocking = results.violations.filter((v) =>
    BLOCKING_IMPACTS.includes(v.impact as (typeof BLOCKING_IMPACTS)[number]),
  );

  expect(
    blocking,
    `Found ${blocking.length} critical/serious axe violations:\n${blocking
      .map((v) => `  - [${v.impact}] ${v.id}: ${v.description}`)
      .join('\n')}`,
  ).toEqual([]);
}

/**
 * Legacy assertion: fails only on critical violations, logs serious as warnings.
 * Kept for backward compatibility with existing specs that may not yet pass
 * the strict assertion.
 */
export async function assertNoCriticalAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_AA_TAGS])
    .analyze();

  const critical = results.violations.filter((v) => v.impact === 'critical');
  const serious = results.violations.filter((v) => v.impact === 'serious');

  if (serious.length > 0) {
    console.warn(
      `[a11y] ${serious.length} serious violations found (not blocking):`,
      serious.map((v) => `  - ${v.id}: ${v.description}`).join('\n'),
    );
  }

  expect(
    critical,
    `Found ${critical.length} critical axe violations`,
  ).toEqual([]);
}

