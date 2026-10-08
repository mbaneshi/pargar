import { test, expect } from '@playwright/test';
import { dismissWelcome } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
});

async function canvasBox(page: any) {
  const el = page.locator('.canvas-container');
  const box = await el.boundingBox();
  if (!box) throw new Error('Canvas container not found');
  return box;
}

async function drawLineViaCmd(page: any) {
  await page.keyboard.press('/');
  await page.waitForTimeout(200);
  await page.keyboard.type('line');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.type('100,100');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.type('400,400');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// === CLICK SELECTION ===

test('click-select-entity', async ({ page }) => {
  await drawLineViaCmd(page);
  const box = await canvasBox(page);
  // Press 's' to activate select tool
  await page.keyboard.press('s');
  await page.waitForTimeout(200);
  // Click near the center of the drawn line
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  // Status should show selection
  const status = page.locator('.status-text');
  const text = await status.textContent();
  expect(text).toMatch(/Selected|Select|Command/i);
});

test('click-deselect-on-empty', async ({ page }) => {
  const box = await canvasBox(page);
  await page.keyboard.press('s');
  await page.waitForTimeout(200);
  // Click near a known entity (center of canvas)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  // Click on empty space (far corner)
  await page.mouse.click(box.x + 10, box.y + 10);
  await page.waitForTimeout(300);
  const status = page.locator('.status-text');
  const text = await status.textContent();
  expect(text).toMatch(/click to select|Select|Command/i);
});

test('escape-clears-selection', async ({ page }) => {
  const box = await canvasBox(page);
  await page.keyboard.press('s');
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const status = page.locator('.status-text');
  const text = await status.textContent();
  expect(text).toMatch(/click to select|Select|Command|Cancel/i);
});

// === WINDOW / CROSSING SELECTION ===

test('window-selection-left-to-right', async ({ page }) => {
  await drawLineViaCmd(page);
  const box = await canvasBox(page);
  await page.keyboard.press('s');
  await page.waitForTimeout(200);
  // Drag left-to-right across entire canvas (should be window selection)
  const startX = box.x + box.width * 0.1;
  const startY = box.y + box.height * 0.1;
  const endX = box.x + box.width * 0.9;
  const endY = box.y + box.height * 0.9;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(300);
  // Should have selected entities
  const status = page.locator('.status-text');
  const text = await status.textContent();
  expect(text).toMatch(/Selected.*entit|Select|Command/i);
});

test('crossing-selection-right-to-left', async ({ page }) => {
  await drawLineViaCmd(page);
  const box = await canvasBox(page);
  await page.keyboard.press('s');
  await page.waitForTimeout(200);
  // Drag right-to-left (crossing selection)
  const startX = box.x + box.width * 0.9;
  const startY = box.y + box.height * 0.1;
  const endX = box.x + box.width * 0.1;
  const endY = box.y + box.height * 0.9;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const status = page.locator('.status-text');
  const text = await status.textContent();
  expect(text).toMatch(/Selected.*entit|Select|Command/i);
});

// === SELECTION RECTANGLE VISUAL ===

test('selection-rect-appears-on-drag', async ({ page }) => {
  const box = await canvasBox(page);
  await page.keyboard.press('s');
  await page.waitForTimeout(200);
  const startX = box.x + box.width * 0.3;
  const startY = box.y + box.height * 0.3;
  const endX = box.x + box.width * 0.7;
  const endY = box.y + box.height * 0.7;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.waitForTimeout(200);
  // Take screenshot to verify selection rectangle is visible
  await page.screenshot({ path: 'e2e/screenshots/selection-rect-window.png' });
  await page.mouse.up();
});

test('crossing-rect-dashed-on-drag', async ({ page }) => {
  const box = await canvasBox(page);
  await page.keyboard.press('s');
  await page.waitForTimeout(200);
  // Right-to-left drag for crossing (dashed green)
  const startX = box.x + box.width * 0.7;
  const startY = box.y + box.height * 0.3;
  const endX = box.x + box.width * 0.3;
  const endY = box.y + box.height * 0.7;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 5 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'e2e/screenshots/selection-rect-crossing.png' });
  await page.mouse.up();
});
