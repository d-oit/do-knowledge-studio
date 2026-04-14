# Visual Testing Guide

Comprehensive guide to visual regression testing.

## Playwright Visual Testing

### Basic Screenshot Comparison
```javascript
const { test, expect } = require('@playwright/test');

test('homepage visual regression', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,
    threshold: 0.2,
  });
});

test('component visual test', async ({ page }) => {
  await page.goto('/storybook');
  const component = await page.locator('[data-testid="button-primary"]');
  await expect(component).toHaveScreenshot('button-primary.png');
});
```

### Masking Dynamic Content
```javascript
test('dashboard with masked dates', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png', {
    mask: [
      page.locator('.timestamp'),
      page.locator('.user-id'),
    ],
  });
});
```

### Multi-Viewport Testing
```javascript
test.describe('responsive design', () => {
  test.use({ viewport: { width: 1280, height: 720 }});
  test('desktop view', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-desktop.png');
  });

  test.use({ viewport: { width: 375, height: 667 }});
  test('mobile view', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('homepage-mobile.png');
  });
});
```

## Storybook + Chromatic

### Setup
```bash
npm install --save-dev chromatic
npx chromatic --project-token=<your-token>
```

### CI Integration
```yaml
- name: Publish to Chromatic
  uses: chromaui/action@v1
  with:
    projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
    exitZeroOnChanges: true
```

## Percy Integration

```yaml
- name: Percy Visual Testing
  uses: percy/exec-action@v0.3.1
  with:
    command: "npm run test:e2e"
  env:
    PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
```

## Applitools

```javascript
const { test, expect } = require('@playwright/test');
const { ClassicRunner, VisualGridRunner, RunnerOptions, Eyes, Target } = require('@applitools/eyes-playwright');

let eyes;

test.beforeEach(async () => {
  eyes = new Eyes(new ClassicRunner());
  await eyes.open({
    appName: 'My App',
    testName: test.info().title,
  });
});

test('visual test with applitools', async ({ page }) => {
  await page.goto('/');
  await eyes.check(Target.window().fully());
});

test.afterEach(async () => {
  await eyes.close();
});
```

## Best Practices

1. **Disable animations** before capturing screenshots
2. **Use deterministic data** (no random timestamps)
3. **Mask dynamic elements** like dates, IDs, usernames
4. **Test critical paths only** - not every component
5. **Review diffs in CI** before merging
