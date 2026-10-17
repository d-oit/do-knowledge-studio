import { test, expect } from '@playwright/test';
import { navClick } from './helpers/navigation';

/**
 * Graph density spec (plans/152).
 *
 * Placement spreads unseeded entities over a band that grows with the library, and
 * the canvas grows with the band. Two user-visible consequences are worth pinning
 * in a real browser: no node may be drawn outside the canvas (where it cannot be
 * clicked at all), and a click must select the node it landed on — a node placed
 * closer than the click-safe distance lets its neighbour's label swallow the click
 * and select the wrong entity (plans/148).
 *
 * The library is seeded through the Zustand persist envelope, so the graph holds
 * far more entities than the authored 800×560 canvas can hold at the preferred
 * spacing without any slow per-entity UI setup.
 */

/** Must match CURRENT_SCHEMA_VERSION in src/lib/studio/migrations.ts. */
const SCHEMA_VERSION = 5;

/** Persist key used by the Zustand store (name option in store.ts). */
const STORE_KEY = 'do-knowledge-studio-store';

/** Enough entities that the placement band outgrows the authored canvas. */
const ENTITY_COUNT = 60;

/** The entity the click test targets — any node at this scale would do. */
const TARGET_ENTITY = `Entity ${ENTITY_COUNT - 1}`;

/**
 * A wide display for the viewport-shape test. Playwright's default viewport is
 * 1280×720; this one is much wider and only slightly taller, so the graph's own
 * canvas box clearly changes aspect without the app shell reflowing to a
 * different layout the way a narrow/mobile viewport would.
 */
const WIDE_VIEWPORT = { width: 2560, height: 1000 };

const SEED_ENVELOPE = {
  state: {
    entities: Array.from({ length: ENTITY_COUNT }, (_, i) => ({
      id: `dense-${i}`,
      name: `Entity ${i}`,
      type: 'note',
      description: `Seeded entity ${i} for graph density coverage`,
      content: '',
      tags: ['seed'],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-06-15T00:00:00Z',
      links: [],
    })),
    claims: [],
    graph: undefined,
    mindMap: undefined,
    links: undefined,
    tags: undefined,
  },
  version: SCHEMA_VERSION,
};

test.describe('Graph density at scale', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ storeKey, envelope }) => {
        localStorage.setItem(storeKey, JSON.stringify(envelope));
      },
      { storeKey: STORE_KEY, envelope: SEED_ENVELOPE },
    );
    await page.goto('/');
    await navClick(page, /graph/i);
    await expect(page.getByRole('application', { name: /graph canvas/i })).toBeVisible();
  });

  test('draws every node inside the canvas', async ({ page }) => {
    const graph = page.getByRole('img', { name: /knowledge graph/i });

    const result = await graph.evaluate((svg) => {
      const canvas = svg.getBoundingClientRect();
      const nodes = Array.from(svg.querySelectorAll('g[role="button"]'));
      const outside = nodes
        .filter((node) => {
          const box = node.getBoundingClientRect();
          return (
            box.left < canvas.left ||
            box.right > canvas.right ||
            box.top < canvas.top ||
            box.bottom > canvas.bottom
          );
        })
        .map((node) => node.getAttribute('aria-label') ?? '');
      return { total: nodes.length, outside };
    });

    expect(result.total).toBe(ENTITY_COUNT);
    expect(result.outside).toEqual([]);
  });

  test('selects the node the click landed on', async ({ page }) => {
    const graph = page.getByRole('img', { name: /knowledge graph/i });
    const target = graph.getByRole('button', { name: new RegExp(`^${TARGET_ENTITY} —`) });

    await target.click();

    // The clicked node reports itself as selected: a click swallowed by a
    // neighbour's label would leave this node unselected.
    await expect(
      graph.getByRole('button', { name: new RegExp(`^${TARGET_ENTITY} —.*\\(selected\\)`) }),
    ).toBeVisible();
  });

  test('reshapes the band to the rendered viewport', async ({ page }) => {
    const graph = page.getByRole('img', { name: /knowledge graph/i });
    /** Canvas aspect from the live viewBox, at rest (zoom 1, no pan). */
    const canvasAspect = (): Promise<number> =>
      graph.evaluate((svg) => {
        const [, , width, height] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
        return height > 0 ? width / height : 0;
      });

    const narrowAspect = await canvasAspect();

    // A wide display of the same library: the band's AREA still comes from the
    // 60 entities, so it may only spread into a wider, shorter rectangle — the
    // canvas must therefore get wider relative to its height, not merely larger.
    // The reshape is driven by the measured canvas box, so the new viewBox lands
    // a frame after the resize; poll instead of assuming one render.
    await page.setViewportSize(WIDE_VIEWPORT);
    await expect.poll(canvasAspect).toBeGreaterThan(narrowAspect);

    // Reshaping must not push any node out of the (still growing) canvas.
    const outside = await graph.evaluate((svg) => {
      const canvas = svg.getBoundingClientRect();
      return Array.from(svg.querySelectorAll('g[role="button"]')).filter((node) => {
        const box = node.getBoundingClientRect();
        return (
          box.left < canvas.left ||
          box.right > canvas.right ||
          box.top < canvas.top ||
          box.bottom > canvas.bottom
        );
      }).length;
    });

    expect(outside).toBe(0);
  });
});
