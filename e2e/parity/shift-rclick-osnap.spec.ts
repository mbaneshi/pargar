import { test, expect } from '@playwright/test';
import { dismissLogin, dismissWelcome } from '../helpers';

// F-2 / F-2a — Shift+RClick must open the AutoCAD OSNAP override menu, NOT the
// regular selection context menu. Plain right-click still shows the existing
// selection menu. Picking a mode sets a one-shot override on the SnapEngine.

test.describe('F-2 — Shift+RClick OSNAP override menu', () => {
  test('Shift+RClick opens OsnapOverrideMenu (not the regular ContextMenu)', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const canvas = page.locator('canvas').first();
    await canvas.click({
      button: 'right',
      modifiers: ['Shift'],
      position: { x: 200, y: 200 },
    });

    await expect(page.locator('[data-testid="osnap-override-menu"]')).toBeVisible({
      timeout: 1000,
    });
    // The regular selection context menu must NOT be open simultaneously.
    await expect(page.locator('.context-menu')).toHaveCount(0);
  });

  test('plain right-click still opens the regular ContextMenu (F-2a)', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const canvas = page.locator('canvas').first();
    await canvas.click({ button: 'right', position: { x: 200, y: 200 } });

    await expect(page.locator('.context-menu')).toBeAttached({ timeout: 1000 });
    // OSNAP override menu must NOT be open.
    await expect(page.locator('[data-testid="osnap-override-menu"]')).toHaveCount(0);
  });

  test('clicking "Endpoint" constrains the next snap query to endpoints only', async ({
    page,
  }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    // Draw a short line from (0,0) to (0.04,0). The line is intentionally
    // short so that, at zoom=1 with a 10-pixel aperture, both endpoints AND
    // the midpoint sit inside aperture from a single cursor position. That
    // is the only way to test that the override actually flips the snap
    // *type* rather than just selecting a different position-based winner.
    //
    // At zoom=1, getPixelsPerWorldUnit() = canvasHeight/(2·zoom). With the
    // default playwright viewport (720px tall) that's 360 px/world. So a
    // 10-px aperture corresponds to ≈0.0278 world units. All three snap
    // candidates (endpoints at 0 and 0.04; midpoint at 0.02) lie within
    // ~0.02 world units of the cursor at (0.018, 0.005) — i.e. inside the
    // aperture, where priority/distance ordering decides the winner.
    const input = page.locator('#cmd-input');
    await input.click();
    await input.fill('L');
    await input.press('Enter');
    await input.fill('0,0');
    await input.press('Enter');
    await input.fill('0.04,0');
    await input.press('Enter');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    await page.evaluate(() => {
      const r = (
        window as unknown as { __nexusRenderer?: { setViewState?: (x: number, y: number, z: number) => void } }
      ).__nexusRenderer;
      r?.setViewState?.(0.02, 0, 1);
    });

    // Activate LINE so resolveSnap fires on subsequent mousemoves.
    await input.click();
    await input.fill('L');
    await input.press('Enter');
    await expect(page.locator('text=Tool: LINE')).toBeVisible({ timeout: 2000 });
    await page.waitForTimeout(150);

    type SnapShape = { type: string; x: number; y: number } | null;

    // Cursor at world (0.018, 0.005). All three snap candidates lie inside
    // the 10-pixel aperture (≈0.0278 world at zoom=1):
    //   - midpoint (0.02, 0):  d ≈ 0.0054 world ≈ 1.95 px (CLOSEST)
    //   - endpoint (0, 0):     d ≈ 0.0187 world ≈ 6.7  px
    //   - endpoint (0.04, 0):  d ≈ 0.0226 world ≈ 8.1  px
    // With default config (no override) the kernel returns 'midpoint'.
    // After the OSNAP-Endpoint override is set, the snap is constrained
    // to endpoint type only — the closer endpoint (0, 0) wins.
    const moveCursorAt = async (x: number, y: number): Promise<SnapShape> =>
      (await page.evaluate(
        ([wx, wy]) => {
          const r = (window as unknown as { __nexusRenderer: any }).__nexusRenderer;
          const s = r.worldToScreen(wx, wy);
          const c = document.querySelector('canvas')!;
          const rect = c.getBoundingClientRect();
          c.dispatchEvent(
            new MouseEvent('mousemove', {
              clientX: rect.x + s.x,
              clientY: rect.y + s.y,
              bubbles: true,
            }),
          );
          return r.lastSnap;
        },
        [x, y],
      )) as SnapShape;

    await moveCursorAt(0.018, 0.005);
    await page.waitForTimeout(50);
    const baseline = await moveCursorAt(0.018, 0.005);
    expect(baseline?.type, 'default snap should be midpoint, closest candidate').toBe(
      'midpoint',
    );

    // Open the OSNAP override menu and pick Endpoint.
    const canvas = page.locator('canvas').first();
    await canvas.click({
      button: 'right',
      modifiers: ['Shift'],
      position: { x: 100, y: 100 },
    });
    await expect(page.locator('[data-testid="osnap-override-menu"]')).toBeVisible({
      timeout: 1000,
    });
    await page.locator('button.item', { hasText: 'Endpoint' }).click();

    // Override is set on the SnapEngine.
    const overrideValue = await page.evaluate(() => {
      const r = (
        window as unknown as { __nexusRenderer?: { snapEngine?: { oneShotOverride?: string | null } } }
      ).__nexusRenderer;
      return r?.snapEngine?.oneShotOverride ?? null;
    });
    expect(overrideValue).toBe('endpoint');

    // Same cursor position; the kernel snap query must now return an endpoint.
    await page.waitForTimeout(50);
    const constrained = await moveCursorAt(0.018, 0.005);
    expect(constrained?.type, 'override must constrain snap to endpoint type').toBe(
      'endpoint',
    );
    // Endpoint position must be one of the line's two endpoints (x = 0 or
    // x = 0.04), NOT the midpoint (x = 0.02). The cursor sits at x = 0.018,
    // so the closer endpoint is (0, 0); but either is acceptable as long as
    // the snap point is at the line's edge, not its midpoint.
    expect(
      Math.abs((constrained?.x ?? 0.02) - 0.02),
      'snap x must not be midpoint x=0.02',
    ).toBeGreaterThan(0.01);
  });

  test('one-shot override is cleared after a point is committed', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const canvas = page.locator('canvas').first();
    await canvas.click({
      button: 'right',
      modifiers: ['Shift'],
      position: { x: 200, y: 200 },
    });
    await expect(page.locator('[data-testid="osnap-override-menu"]')).toBeVisible({
      timeout: 1000,
    });
    await page.locator('button.item', { hasText: 'Endpoint' }).click();

    // Activate LINE and commit a point via typed coordinate.
    const input = page.locator('#cmd-input');
    await input.click();
    await input.fill('L');
    await input.press('Enter');
    await input.fill('5,5');
    await input.press('Enter');
    await page.waitForTimeout(100);

    const overrideAfterCommit = await page.evaluate(() => {
      const r = (
        window as unknown as { __nexusRenderer?: { snapEngine?: { oneShotOverride?: string | null } } }
      ).__nexusRenderer;
      return r?.snapEngine?.oneShotOverride ?? null;
    });
    expect(overrideAfterCommit, 'override must be consumed after point commit').toBeNull();
  });

  test('disabled override shows "not yet implemented" tooltip', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const canvas = page.locator('canvas').first();
    await canvas.click({
      button: 'right',
      modifiers: ['Shift'],
      position: { x: 200, y: 200 },
    });
    await expect(page.locator('[data-testid="osnap-override-menu"]')).toBeVisible({
      timeout: 1000,
    });

    const tan = page.locator('button.item', { hasText: 'Tangent' });
    await expect(tan).toBeDisabled();
    await expect(tan).toHaveAttribute('title', 'not yet implemented');
  });
});
