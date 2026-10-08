import { test, expect } from '@playwright/test';
import { dismissLogin, dismissWelcome } from '../helpers';

// F-1 / F-1a — Spacebar must behave like Enter in the CommandLine,
// matching AutoCAD muscle memory. See docs/agent-tasks/sprint-3-muscle-memory.md.

test.describe('F-1 — Spacebar = Enter in CommandLine', () => {
  test('typing L + Space activates LINE tool', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const input = page.locator('#cmd-input');
    await input.click();
    await input.fill('L');
    // Space MUST submit the command (not insert a literal space)
    await input.press(' ');
    await expect(page.locator('text=Tool: LINE')).toBeVisible({ timeout: 2000 });
  });

  test('Space accepts navigated autocomplete suggestion (subsumes F-1a)', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const input = page.locator('#cmd-input');
    await input.click();
    // Type a prefix that produces multiple suggestions, then navigate to one.
    await input.fill('LI');
    await page.locator('.autocomplete').waitFor({ state: 'visible', timeout: 2000 });
    // Navigate down to mark the first (or next) suggestion as user-chosen.
    await input.press('ArrowDown');
    // Space accepts the navigated suggestion (just like Enter would).
    await input.press(' ');
    await expect(page.locator('.autocomplete')).toBeHidden({ timeout: 1000 });
  });

  test('Space on empty input repeats last command', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const input = page.locator('#cmd-input');
    await input.click();
    // Run LINE once via Enter so it lands in history.
    await input.fill('L');
    await input.press('Enter');
    await expect(page.locator('text=Tool: LINE')).toBeVisible({ timeout: 2000 });
    // Cancel to clear active tool back to select.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    // Empty input + Space → repeat last command (LINE)
    await input.click();
    await input.press(' ');
    await expect(page.locator('text=Tool: LINE')).toBeVisible({ timeout: 2000 });
  });

  test('literal space inside coordinate input is preserved mid-entry', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const input = page.locator('#cmd-input');
    await input.click();
    // Activate LINE so the next input is a coordinate prompt.
    await input.fill('L');
    await input.press('Enter');
    await expect(page.locator('text=Tool: LINE')).toBeVisible({ timeout: 2000 });
    // Now type a coordinate with literal spaces — user types digits, comma, space, digits.
    await input.click();
    await input.press('1');
    await input.press('0');
    await input.press('0');
    await input.press(',');
    // The space here MUST stay literal: there's no command-name shape; the prompt is mid-coord.
    await input.press(' ');
    await input.press('1');
    await input.press('0');
    await input.press('0');
    // Verify the input now contains literal spaces — not yet submitted.
    await expect(input).toHaveValue(/100,\s*100/);
  });
});
