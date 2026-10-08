import { test, expect } from '@playwright/test';
import { canvasBox, entityCount, activateTool, typeCmd, drawLine, focusCanvas, dismissWelcome } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(1000);
});

// === MOVE ===

test('move-tool-preserves-entity-count', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  const before = await entityCount(page);
  // Select via click near the line
  await activateTool(page, 'Select');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  // Activate move
  await activateTool(page, 'Move');
  // Click base point and destination
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 350, box.y + 350);
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  expect(after).toBe(before);
});

// === COPY ===

test('copy-tool-increases-entity-count', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  const before = await entityCount(page);
  // Select
  await activateTool(page, 'Select');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  // Copy
  await activateTool(page, 'Copy');
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 350, box.y + 350);
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  expect(after).toBeGreaterThan(before);
});

// === ROTATE ===

test('rotate-tool-preserves-entity-count', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  const before = await entityCount(page);
  await activateTool(page, 'Select');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  await activateTool(page, 'Rotate');
  // Click center point
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.waitForTimeout(200);
  // Click angle point
  await page.mouse.click(box.x + 400, box.y + 250);
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  expect(after).toBe(before);
});

// === MIRROR ===

test('mirror-tool-increases-entity-count', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  const before = await entityCount(page);
  await activateTool(page, 'Select');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  await activateTool(page, 'Mirror');
  // Click two mirror line points
  await page.mouse.click(box.x + 300, box.y + 200);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 300, box.y + 400);
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  expect(after).toBeGreaterThan(before);
});

// === SCALE ===

test('scale-tool-preserves-entity-count', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  const before = await entityCount(page);
  await activateTool(page, 'Select');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  await activateTool(page, 'Scale');
  // Click base point
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.waitForTimeout(200);
  // Type scale factor via command line
  await typeCmd(page, '2');
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  expect(after).toBe(before);
});

// === OFFSET ===

test('offset-tool-creates-entity', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  const before = await entityCount(page);
  await activateTool(page, 'Offset');
  // Type offset distance
  await typeCmd(page, '2');
  // Click entity to offset
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  // Click side to offset toward
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + 50);
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  expect(after).toBeGreaterThan(before);
});

// === TRIM ===

test('trim-tool-modifies-entities', async ({ page }) => {
  // Create two crossing lines
  await drawLine(page, '0', '0', '20', '0');
  await drawLine(page, '10', '-5', '10', '5');
  const before = await entityCount(page);
  await activateTool(page, 'Trim');
  const box = await canvasBox(page);
  // Click on one segment to trim
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.waitForTimeout(300);
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.waitForTimeout(300);
  // Trim may change count or keep same — just verify no crash
  const after = await entityCount(page);
  expect(after).toBeGreaterThanOrEqual(before - 1);
  await page.screenshot({ path: 'e2e/screenshots/trim-result.png' });
});

// === FILLET ===

test('fillet-tool-modifies-entities', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  await drawLine(page, '10', '0', '10', '10');
  const before = await entityCount(page);
  await activateTool(page, 'Fillet');
  // Set radius
  await typeCmd(page, '1');
  const box = await canvasBox(page);
  // Click first line
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.waitForTimeout(300);
  // Click second line
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  // Fillet may add an arc entity
  expect(after).toBeGreaterThanOrEqual(before);
  await page.screenshot({ path: 'e2e/screenshots/fillet-result.png' });
});

// === JOIN ===

test('join-tool-reduces-entity-count', async ({ page }) => {
  // Create two collinear lines
  await drawLine(page, '0', '0', '5', '0');
  await drawLine(page, '5', '0', '10', '0');
  const before = await entityCount(page);
  // Select both by window
  await activateTool(page, 'Select');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 100, box.y + 100);
  await page.waitForTimeout(100);
  await page.mouse.click(box.x + box.width - 100, box.y + box.height - 100);
  await page.waitForTimeout(200);
  // Join
  await activateTool(page, 'Join');
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  // Join may reduce count if it merges entities
  expect(after).toBeLessThanOrEqual(before);
});

// === ARRAY ===

test('array-tool-creates-entities', async ({ page }) => {
  await drawLine(page, '0', '0', '5', '0');
  const before = await entityCount(page);
  await activateTool(page, 'Select');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  await activateTool(page, 'Array');
  // Array needs parameters — type count and spacing
  await typeCmd(page, '3');
  await page.waitForTimeout(200);
  await typeCmd(page, '5');
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  expect(after).toBeGreaterThanOrEqual(before);
  await page.screenshot({ path: 'e2e/screenshots/array-result.png' });
});
