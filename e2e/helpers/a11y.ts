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
 * `allowRules` names rule ids that are documented, measured exceptions for the
 * page under test. It is deliberately per-call and per-rule: the previous
 * implementation (`assertNoCriticalAxeViolations`) skipped an entire impact
 * level, which also silenced every *future* serious rule on that page.
 */
export async function assertNoAxeViolations(
  page: Page,
  { allowRules = [] }: { allowRules?: readonly string[] } = {},
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_22_AA_TAGS])
    .analyze();

  const allowed = new Set(allowRules);
  const blocking = results.violations.filter(
    (v) =>
      BLOCKING_IMPACTS.includes(v.impact as (typeof BLOCKING_IMPACTS)[number]) &&
      !allowed.has(v.id),
  );

  expect(
    blocking,
    `Found ${blocking.length} critical/serious axe violations:\n${blocking
      .map((v) => `  - [${v.impact}] ${v.id}: ${v.description}`)
      .join('\n')}`,
  ).toEqual([]);
}
