import { test, expect } from '@playwright/test';
import { dismissLogin, dismissWelcome } from '../helpers';

// P1-3 — When a drawing tool is active, the renderer must overlay AutoCAD-style
// crosshair lines (CURSORSIZE-controlled) plus a 12px PICKBOX at the
// intersection. CSS `cursor: crosshair` already works as the OS-level fallback
// (Sprint-2 verification confirmed this). This test asserts the renderer-level
// THREE.Line overlay exists in the scene graph when LINE is active.

test.describe('P1-3 — Full-viewport CURSORSIZE crosshair overlay', () => {
  test('LINE tool activates crosshair overlay in renderer scene', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    // Activate LINE.
    const input = page.locator('#cmd-input');
    await input.click();
    await input.fill('L');
    await input.press('Enter');
    await expect(page.locator('text=Tool: LINE')).toBeVisible({ timeout: 2000 });

    // Move mouse over canvas so the crosshair has a position to track.
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas not measurable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Probe the renderer scene for a crosshair group. The renderer is exposed on
    // window.__nexusApp during dev for E2E observation.
    const result = await page.evaluate(() => {
      const renderer = (window as unknown as { __nexusRenderer?: unknown }).__nexusRenderer;
      if (!renderer) return { reachable: false };
      const r = renderer as { crosshairGroup?: { children?: unknown[] }; crosshairVisible?: boolean };
      return {
        reachable: true,
        visible: !!r.crosshairVisible,
        childrenCount: r.crosshairGroup?.children?.length ?? 0,
      };
    });

    expect(result.reachable, 'window.__nexusRenderer must be exposed for E2E').toBe(true);
    expect(result.visible).toBe(true);
    // Exactly 3 children: horizontal line, vertical line, 12px PICKBOX loop.
    // Tightened from >=2 so a regression that drops the pickbox is caught.
    expect(result.childrenCount).toBe(3);
  });

  test('crosshair clears when no tool active', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const input = page.locator('#cmd-input');
    await input.click();
    await input.fill('L');
    await input.press('Enter');
    await expect(page.locator('text=Tool: LINE')).toBeVisible({ timeout: 2000 });

    // Cancel back to idle.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      const renderer = (window as unknown as { __nexusRenderer?: unknown }).__nexusRenderer;
      const r = renderer as { crosshairVisible?: boolean };
      return { visible: !!r?.crosshairVisible };
    });
    expect(result.visible).toBe(false);
  });
});
