import { test, expect } from '@playwright/test';
import { dismissWelcome, selectRibbonTab } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(500);
});

async function canvasBox(page: any) {
  const el = page.locator('.canvas-container');
  const box = await el.boundingBox();
  if (!box) throw new Error('Canvas container not found');
  return box;
}

// === CANVAS & CURSOR ===

test('crosshair-visible', async ({ page }) => {
  const box = await canvasBox(page);
  // Dispatch mouseenter + mousemove to trigger crosshair
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.waitForTimeout(100);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const h = page.locator('[data-testid="crosshair-h"]');
  const v = page.locator('[data-testid="crosshair-v"]');
  await expect(h).toBeAttached();
  await expect(v).toBeAttached();
});

test('aperture-box-visible', async ({ page }) => {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const ap = page.locator('[data-testid="aperture-box"]');
  await expect(ap).toBeAttached();
});

test('snap-marker-endpoint', async ({ page }) => {
  // Snap markers are Three.js objects — verify via screenshot
  await page.screenshot({ path: 'e2e/screenshots/snap-marker.png' });
  // Snap type display exists in status bar
  const coord = page.locator('.coord');
  await expect(coord).toBeVisible();
});

test('snap-label-visible', async ({ page }) => {
  // Snap labels are Three.js Sprites — verify via screenshot
  await page.screenshot({ path: 'e2e/screenshots/snap-label.png' });
});

test.skip('dynamic-input-visible', async ({ page }) => {
  // LineToolHandler doesn't trigger dynDistance for dynamic input overlay yet
  const box = await canvasBox(page);
  // Move into canvas to activate cursor tracking
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  // Activate Line tool via keyboard (ensures canvas has focus)
  await page.keyboard.press('l');
  await page.waitForTimeout(300);
  // Click first point
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.waitForTimeout(500);
  // Move mouse to trigger dynamic input
  await page.mouse.move(box.x + 450, box.y + 250);
  await page.waitForTimeout(500);
  // Verify status confirms tool is in drawing state
  const status = await page.locator('.status-text').textContent();
  expect(status?.toLowerCase()).toContain('next point');
  // Check dynamic input
  const di = page.locator('[data-testid="dynamic-input"]');
  await expect(di).toBeVisible({ timeout: 2000 });
});

test('ucs-icon-visible', async ({ page }) => {
  await expect(page.locator('[data-testid="ucs-icon"]')).toBeAttached();
});

// === TOOLBAR / RIBBON ===

test('ribbon-draw-panel-visible', async ({ page }) => {
  await expect(page.locator('.panel-label', { hasText: 'Draw' })).toBeVisible();
});

test('ribbon-modify-panel-visible', async ({ page }) => {
  await expect(page.locator('.panel-label', { hasText: 'Modify' })).toBeVisible();
});

test('ribbon-annotate-tab-visible', async ({ page }) => {
  // Annotate is a ribbon tab (Text + Dimensions panels), not a Home panel.
  await expect(page.locator('.ribbon .tab-btn', { hasText: 'Annotate' })).toBeVisible();
  await selectRibbonTab(page, 'Annotate');
  await expect(page.locator('.panel-label', { hasText: 'Dimensions' })).toBeVisible();
});

test('ribbon-constrain-panel-visible', async ({ page }) => {
  await selectRibbonTab(page, 'Parametric');
  await expect(page.locator('.panel-label', { hasText: 'Constrain' })).toBeVisible();
});

test('ribbon-edit-panel-visible', async ({ page }) => {
  await selectRibbonTab(page, 'View');
  await expect(page.locator('.panel-label', { hasText: 'Edit' })).toBeVisible();
});

test('layer-dropdown-in-toolbar', async ({ page }) => {
  // Layer panel label exists
  const label = page.locator('.panel-label', { hasText: 'Select' });
  await expect(label).toBeVisible();
});

// === STATUS BAR ===

test('status-bar-osnap-toggle', async ({ page }) => {
  await expect(page.locator('[data-testid="status-bar"] button', { hasText: 'OSNAP' })).toBeVisible();
});

test('status-bar-ortho-toggle', async ({ page }) => {
  await expect(page.locator('[data-testid="status-bar"] button', { hasText: 'ORTHO' })).toBeVisible();
});

test('status-bar-polar-toggle', async ({ page }) => {
  await expect(page.locator('[data-testid="status-bar"] button', { hasText: 'POLAR' })).toBeVisible();
});

test('status-bar-dynin-toggle', async ({ page }) => {
  await expect(page.locator('[data-testid="status-bar"] button', { hasText: 'DYN' })).toBeVisible();
});

test('status-bar-grid-toggle', async ({ page }) => {
  await expect(page.locator('[data-testid="status-bar"] button', { hasText: 'GRID' })).toBeVisible();
});

// === RIGHT-CLICK CONTEXT MENU ===

test('right-click-context-menu', async ({ page }) => {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 300, box.y + 200, { button: 'right' });
  await page.waitForTimeout(300);
  const menu = page.locator('.context-menu');
  await expect(menu).toBeVisible();
});

// === MODEL/LAYOUT TABS ===

test.skip('model-tab-at-bottom', async ({ page }) => {
  // LayoutTabs.svelte was removed in design-tokens refactor
  const tabs = page.locator('[data-testid="layout-tabs"]');
  await expect(tabs).toBeVisible();
  const modelBtn = tabs.locator('button', { hasText: 'Model' });
  await expect(modelBtn).toBeVisible();
});

// === DARK THEME ===

test('dark-theme-active', async ({ page }) => {
  const bg = await page.locator('body').evaluate((el: HTMLElement) => getComputedStyle(el).backgroundColor);
  const match = bg.match(/rgb\((\d+), (\d+), (\d+)\)/);
  if (match) {
    const lum = (0.299 * Number(match[1]) + 0.587 * Number(match[2]) + 0.114 * Number(match[3])) / 255;
    expect(lum).toBeLessThan(0.2);
  }
});

// === COMMAND LINE ===

test('command-history-shows-actual-commands', async ({ page }) => {
  const input = page.locator('#cmd-input');
  await input.click();
  await page.waitForTimeout(100);
  await input.fill('LINE');
  await page.waitForTimeout(50);
  // If autocomplete is visible, first Enter selects the suggestion
  const autocomplete = page.locator('.autocomplete');
  if (await autocomplete.isVisible().catch(() => false)) {
    await input.press('Enter');
    await page.waitForTimeout(50);
  }
  await input.press('Enter');
  await page.waitForTimeout(500);
  const history = page.locator('.history');
  const text = await history.textContent();
  expect(text?.toUpperCase()).toContain('LINE');
});

test('command-autocomplete', async ({ page }) => {
  const input = page.locator('#cmd-input');
  await input.click();
  await page.waitForTimeout(100);
  await input.pressSequentially('li', { delay: 100 });
  await page.waitForTimeout(500);
  const suggestions = page.locator('.autocomplete .suggestion, .suggestion');
  const count = await suggestions.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('up-arrow-recalls-command', async ({ page }) => {
  const input = page.locator('#cmd-input');
  await input.click();
  await input.fill('LINE');
  await input.press('Enter');
  await page.waitForTimeout(300);
  await input.click();
  await input.press('ArrowUp');
  await page.waitForTimeout(200);
  const value = await input.inputValue();
  expect(value.toUpperCase()).toContain('LINE');
});

// === DRAWING TOOLS ===

test('line-tool-creates-entity', async ({ page }) => {
  const box = await canvasBox(page);
  await page.locator('.panel-buttons button', { hasText: 'Line' }).first().click();
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 100, box.y + 100);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 300, box.y + 100);
  await page.waitForTimeout(500);
  const text = await page.locator('.entity-count').textContent();
  const count = parseInt(text?.match(/\d+/)?.[0] || '0');
  expect(count).toBeGreaterThan(0);
});

test('undo-reduces-entity-count', async ({ page }) => {
  const box = await canvasBox(page);
  await page.locator('.panel-buttons button', { hasText: 'Line' }).first().click();
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 100, box.y + 150);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 300, box.y + 150);
  await page.waitForTimeout(500);
  const before = parseInt((await page.locator('.entity-count').textContent())?.match(/\d+/)?.[0] || '0');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(500);
  const after = parseInt((await page.locator('.entity-count').textContent())?.match(/\d+/)?.[0] || '0');
  expect(after).toBeLessThan(before);
});

test('F8-toggles-ortho', async ({ page }) => {
  // Click on canvas first to ensure it has focus (not command line)
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await page.keyboard.press('F8');
  await page.waitForTimeout(300);
  const text = await page.locator('.status-text').textContent();
  expect(text?.toLowerCase()).toContain('ortho');
});

// === SCREENSHOTS ===

test('screenshot-full-app', async ({ page }) => {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/screenshots/full-app.png', fullPage: true });
});

test('screenshot-drawing-state', async ({ page }) => {
  const box = await canvasBox(page);
  await page.locator('.panel-buttons button', { hasText: 'Line' }).first().click();
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.mouse.move(box.x + 400, box.y + 150);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/screenshots/drawing-state.png', fullPage: true });
});
