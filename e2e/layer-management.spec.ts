import { test, expect } from '@playwright/test';
import { dismissWelcome } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(1000);
});

test('open-layer-panel-via-toolbar', async ({ page }) => {
  // The "Layers" button toggles app.layerManagerOpen
  const layersBtn = page.locator('button', { hasText: 'Layers' });
  await expect(layersBtn).toBeVisible({ timeout: 5000 });

  // Panel should not be visible initially
  const panel = page.locator('.layer-manager');
  await expect(panel).not.toBeVisible();

  // Click to open
  await layersBtn.click();
  await page.waitForTimeout(300);
  await expect(panel).toBeVisible();
});

test('default-layer-0-exists', async ({ page }) => {
  const layersBtn = page.locator('button', { hasText: 'Layers' });
  await layersBtn.click();
  await page.waitForTimeout(300);

  // Layer "0" should be present in the layer list
  const layer0 = page.locator('.layer-manager .name-text', { hasText: '0' });
  await expect(layer0).toBeVisible({ timeout: 3000 });
});

test('create-new-layer', async ({ page }) => {
  const layersBtn = page.locator('button', { hasText: 'Layers' });
  await layersBtn.click();
  await page.waitForTimeout(300);

  // Count initial layers
  const initialRows = await page.locator('.layer-manager .layer-row').count();

  // Click "+ New" button
  const newBtn = page.locator('.layer-manager .action-btn', { hasText: '+ New' });
  await expect(newBtn).toBeVisible({ timeout: 3000 });
  await newBtn.click();
  await page.waitForTimeout(300);

  // Should have one more layer row
  const afterRows = await page.locator('.layer-manager .layer-row').count();
  expect(afterRows).toBe(initialRows + 1);
});

test('close-layer-panel', async ({ page }) => {
  const layersBtn = page.locator('button', { hasText: 'Layers' });
  await layersBtn.click();
  await page.waitForTimeout(300);

  const panel = page.locator('.layer-manager');
  await expect(panel).toBeVisible();

  // Click close button
  const closeBtn = page.locator('.layer-manager .close-btn');
  await closeBtn.click();
  await page.waitForTimeout(300);
  await expect(panel).not.toBeVisible();
});

test('toggle-layer-visibility', async ({ page }) => {
  const layersBtn = page.locator('button', { hasText: 'Layers' });
  await layersBtn.click();
  await page.waitForTimeout(300);

  // Click the visibility toggle on the first layer row
  const visBtn = page.locator('.layer-manager .layer-row .col-vis .icon-btn').first();
  await expect(visBtn).toBeVisible({ timeout: 3000 });

  // Toggle off — the button should get the "off" class
  await visBtn.click();
  await page.waitForTimeout(200);
  await expect(visBtn).toHaveClass(/off/);

  // Toggle back on
  await visBtn.click();
  await page.waitForTimeout(200);
  await expect(visBtn).not.toHaveClass(/off/);
});

test('open-layer-panel-via-keyboard-ctrl-l', async ({ page }) => {
  const panel = page.locator('.layer-manager');
  await expect(panel).not.toBeVisible();

  await page.keyboard.press('Control+l');
  await page.waitForTimeout(300);
  await expect(panel).toBeVisible();
});
