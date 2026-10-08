import { test, expect } from '@playwright/test';
import { dismissLogin, dismissWelcome } from '../helpers';

const DRAW_BUTTONS = [
  { label: 'Line', expectedTool: 'LINE' },
  { label: 'Center, Radius', expectedTool: 'CIRCLE' },
  { label: 'Corner', expectedTool: 'RECTANGLE' },
  { label: '3-Point', expectedTool: 'ARC' },
  { label: 'Ellipse', expectedTool: 'ELLIPSE' },
  { label: 'Spline', expectedTool: 'SPLINE' },
  { label: 'Pline', expectedTool: 'POLYLINE' },
] as const;

test.describe('Ribbon Draw buttons activate their tools', () => {
  for (const { label, expectedTool } of DRAW_BUTTONS) {
    test(`${label} button activates ${expectedTool}`, async ({ page }) => {
      await page.goto('/');
      await dismissLogin(page);
      await dismissWelcome(page, 'new');
      // Use exact text match to avoid substring hits (e.g. 'Pline' inside 'Spline')
      await page.locator('.panel-buttons button').filter({ hasText: new RegExp(`^${label}$`) }).first().click();
      await page.waitForTimeout(150);
      // Status bar shows "Tool: <NAME>" while a drawing tool is active
      await expect(page.locator(`text=Tool: ${expectedTool}`)).toBeVisible({ timeout: 2000 });
    });
  }
});
