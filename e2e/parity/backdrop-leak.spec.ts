import { test, expect } from '@playwright/test';
import { dismissLogin, dismissWelcome } from '../helpers';

// F-4 — ContextMenu's full-viewport backdrop must be torn down on Esc dismissal,
// otherwise it traps every subsequent click. Sprint-2 verification observed
// this bug live; root cause was a missing keydown handler. See
// docs/audit/sprint-2/verification.md and docs/agent-tasks/sprint-3-muscle-memory.md.

test.describe('F-4 — ContextMenu Esc dismissal', () => {
  test('right-click → Esc removes backdrop and unblocks subsequent clicks', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const canvas = page.locator('canvas').first();
    // Right-click the canvas to open the context menu.
    await canvas.click({ button: 'right', position: { x: 200, y: 200 } });

    // Backdrop must be present while the menu is visible.
    await expect(page.locator('.backdrop')).toBeAttached({ timeout: 1000 });
    await expect(page.locator('.context-menu')).toBeAttached({ timeout: 1000 });

    // Press Escape — the menu and its backdrop must both be removed from the DOM.
    await page.keyboard.press('Escape');
    await expect(page.locator('.context-menu')).toHaveCount(0, { timeout: 1000 });
    await expect(page.locator('.backdrop')).toHaveCount(0, { timeout: 1000 });

    // Sanity check: a follow-up canvas click is no longer trapped by a stale backdrop.
    await canvas.click({ position: { x: 300, y: 300 } });
  });
});
