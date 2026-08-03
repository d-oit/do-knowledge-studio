import { test, expect } from '@playwright/test';

/** WCAG 1.4.3: Minimum contrast ratio for normal text */
const MIN_CONTRAST_RATIO = 4.5;

/**
 * Calculate the relative luminance of a hex color per WCAG formula.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(hex: string): number {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;

  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

/** Calculate contrast ratio between two hex colors */
function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Theme accent colors from src/app/globals.css
const SAFFRON_LIGHT = '#9a5c2a';
const SAFFRON_DARK = '#e5944a';

// Approximate background colors for each theme
const BG_LIGHT = '#fafaf9'; // --background light (stone-50)
const BG_DARK = '#1c1917'; // --background dark (stone-900)

test.describe('Color contrast — WCAG 1.4.3', () => {
  test('Saffron accent (#9a5c2a) on light background meets 4.5:1', () => {
    const ratio = contrastRatio(SAFFRON_LIGHT, BG_LIGHT);
    expect(
      ratio,
      `Saffron light #${SAFFRON_LIGHT.slice(1)} on bg #${BG_LIGHT.slice(1)}: ${ratio.toFixed(2)}:1 (needs ${MIN_CONTRAST_RATIO}:1)`,
    ).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
  });

  test('Saffron accent (#e5944a) on dark background meets 4.5:1', () => {
    const ratio = contrastRatio(SAFFRON_DARK, BG_DARK);
    expect(
      ratio,
      `Saffron dark #${SAFFRON_DARK.slice(1)} on bg #${BG_DARK.slice(1)}: ${ratio.toFixed(2)}:1 (needs ${MIN_CONTRAST_RATIO}:1)`,
    ).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
  });

  test('Saffron light on white meets 4.5:1 for text use', () => {
    const ratio = contrastRatio(SAFFRON_LIGHT, '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
  });

  test('Saffron deep (#6a4a1c) on light background meets 4.5:1', () => {
    const ratio = contrastRatio('#6a4a1c', BG_LIGHT);
    expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
  });

  test('contrast ratio utility: black on white is high contrast', () => {
    const ratio = contrastRatio('#000000', '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(20); // Should be ~21:1
  });

  test('contrast ratio utility: same color has ratio 1.0', () => {
    const ratio = contrastRatio('#888888', '#888888');
    expect(ratio).toBeCloseTo(1.0, 1);
  });
});
