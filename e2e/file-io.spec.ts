import { test, expect } from '@playwright/test';
import { entityCount, typeCmd, drawLine, dismissWelcome } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(1000);
});

// === SAVE PROJECT ===

test('save-via-ctrl-s-shows-saved-status', async ({ page }) => {
  // Draw something first
  await drawLine(page, '0', '0', '10', '0');
  // Focus canvas so Ctrl+S is handled by the app
  const box = await page.locator('.canvas-container').boundingBox();
  if (box) await page.mouse.click(box.x + 50, box.y + 50);
  await page.waitForTimeout(200);
  // Trigger save via Ctrl+S
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(500);
  // Check status text or autosave indicator
  const status = await page.locator('.status-text').textContent();
  const autosave = await page.locator('.autosave').textContent().catch(() => '');
  const combined = (status + ' ' + autosave).toLowerCase();
  expect(combined).toContain('saved');
});

test('save-via-file-menu-shows-saved-status', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  // Open File menu
  await page.locator('.menu-trigger', { hasText: 'File' }).click();
  await page.waitForTimeout(200);
  // Click Save
  await page.locator('.dropdown button', { hasText: 'Save' }).first().click();
  await page.waitForTimeout(500);
  // Check status text or autosave indicator
  const status = await page.locator('.status-text').textContent();
  const autosave = await page.locator('.autosave').textContent().catch(() => '');
  const combined = (status + ' ' + autosave).toLowerCase();
  expect(combined).toContain('saved');
});

// === EXPORT DXF ===

test('export-dxf-shows-exported-status', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  // Open File menu
  await page.locator('.menu-trigger', { hasText: 'File' }).click();
  await page.waitForTimeout(200);
  // Click Export DXF
  await page.locator('.dropdown button', { hasText: 'Export DXF' }).click();
  await page.waitForTimeout(500);
  const status = await page.locator('.status-text').textContent();
  expect(status?.toLowerCase()).toContain('export');
});

// === NEW PROJECT ===

// App bug: handleNew() recreates the kernel but entity count display doesn't reset
test.fixme('new-project-resets-entity-count', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  await drawLine(page, '0', '5', '10', '5');
  const before = await entityCount(page);
  expect(before).toBeGreaterThanOrEqual(2);
  await page.locator('.menu-trigger', { hasText: 'File' }).click();
  await page.waitForTimeout(200);
  await page.locator('.dropdown button', { hasText: 'New Project' }).click();
  await page.waitForTimeout(500);
  const after = await entityCount(page);
  expect(after).toBeLessThan(before);
});

// === FILE MENU UI ===

test('file-menu-opens-and-closes', async ({ page }) => {
  const trigger = page.locator('.menu-trigger', { hasText: 'File' });
  await trigger.click();
  await page.waitForTimeout(200);
  const dropdown = page.locator('.dropdown');
  await expect(dropdown).toBeVisible();
  // Click backdrop to close
  await page.mouse.click(10, 10);
  await page.waitForTimeout(200);
  await expect(dropdown).not.toBeVisible();
});

test('file-menu-shows-project-name', async ({ page }) => {
  await page.locator('.menu-trigger', { hasText: 'File' }).click();
  await page.waitForTimeout(200);
  const info = page.locator('.menu-info');
  const text = await info.first().textContent();
  expect(text?.toLowerCase()).toContain('project');
});
