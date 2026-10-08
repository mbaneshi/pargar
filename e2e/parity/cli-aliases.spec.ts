import { test, expect } from '@playwright/test';
import { dismissLogin, dismissWelcome } from '../helpers';

const ALIASES = [
  { typed: 'L', expectedTool: 'LINE' },
  { typed: 'LINE', expectedTool: 'LINE' },
  { typed: 'C', expectedTool: 'CIRCLE' },
  { typed: 'CIRCLE', expectedTool: 'CIRCLE' },
  { typed: 'REC', expectedTool: 'RECTANGLE' },
  { typed: 'RECTANGLE', expectedTool: 'RECTANGLE' },
] as const;

test.describe('Command-line aliases dispatch on a single Enter', () => {
  for (const { typed, expectedTool } of ALIASES) {
    test(`typing ${typed} + Enter activates ${expectedTool}`, async ({ page }) => {
      await page.goto('/');
      await dismissLogin(page);
      await dismissWelcome(page, 'new');
      const input = page.locator('#cmd-input');
      await input.click();
      await input.fill(typed);
      // Single Enter — autocomplete must NOT swallow it (post Task 2 fix)
      await input.press('Enter');
      await expect(page.locator(`text=Tool: ${expectedTool}`)).toBeVisible({ timeout: 2000 });
    });
  }

  test('/ shortcut focuses the command line', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');
    // Click on canvas to remove focus from the input
    await page.locator('canvas').first().click({ position: { x: 200, y: 200 } });
    await page.keyboard.press('/');
    await expect(page.locator('#cmd-input')).toBeFocused();
  });

  test('Ctrl+Z undoes the canvas state when CLI input is focused', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');
    const input = page.locator('#cmd-input');
    // Draw a line via typed coords — input has focus throughout
    await input.click();
    await input.fill('L');
    await input.press('Enter');
    await input.fill('100,100');
    await input.press('Enter');
    await input.fill('@200,0');
    await input.press('Enter');
    // Entity count goes 0 → 1
    await expect(page.locator('.entity-count')).toContainText('1 entity', { timeout: 2000 });
    // Refocus the input then Ctrl+Z — should undo the canvas state, not the input's text
    await input.click();
    await page.keyboard.press('Control+z');
    // Mac variant
    await page.keyboard.press('Meta+z');
    await expect(page.locator('.entity-count')).toContainText('0 entities', { timeout: 2000 });
  });
});
