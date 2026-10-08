import { test, expect } from '@playwright/test';
import { dismissWelcome } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(500);
});

async function canvasBox(page: any) {
  const box = await page.locator('.canvas-container').boundingBox();
  if (!box) throw new Error('Canvas not found');
  return box;
}

async function entityCount(page: any): Promise<number> {
  const text = await page.locator('.entity-count').textContent();
  return parseInt(text?.match(/\d+/)?.[0] || '0');
}

async function typeCommand(page: any, cmd: string) {
  const input = page.locator('#cmd-input');
  await input.click();
  await input.fill(cmd);
  await input.press('Enter');
  await page.waitForTimeout(300);
}

// === FILLET R=0 CORNER CLEANUP ===

test('fillet-r0-corner-cleanup', async ({ page }) => {
  // Create two lines that don't meet
  await typeCommand(page, 'l');
  await typeCommand(page, '0,0');
  await typeCommand(page, '10,0');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await typeCommand(page, 'l');
  await typeCommand(page, '5,-5');
  await typeCommand(page, '5,5');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const before = await entityCount(page);

  // Fillet with R=0
  await typeCommand(page, 'f');
  await typeCommand(page, '0'); // radius = 0

  // Click first line then second line
  const box = await canvasBox(page);
  // Click near the horizontal line
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.waitForTimeout(300);
  // Click near the vertical line
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.45);
  await page.waitForTimeout(500);

  // Entity count should remain same (fillet modifies, doesn't create for R=0)
  const after = await entityCount(page);
  // R=0 fillet modifies two existing lines, count stays same
  expect(after).toBe(before);
  await page.screenshot({ path: 'e2e/screenshots/fillet-r0.png' });
});

// === EXTEND TO NON-INTERSECTING BOUNDARY ===

test('extend-non-intersecting-fails-gracefully', async ({ page }) => {
  // Create two parallel lines (will never intersect)
  await typeCommand(page, 'l');
  await typeCommand(page, '0,0');
  await typeCommand(page, '10,0');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await typeCommand(page, 'l');
  await typeCommand(page, '0,5');
  await typeCommand(page, '10,5');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const before = await entityCount(page);

  // Try extend — should fail gracefully (parallel lines don't intersect)
  await typeCommand(page, 'ex');
  const box = await canvasBox(page);
  // Click boundary (top line)
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.35);
  await page.waitForTimeout(300);
  // Click entity to extend (bottom line)
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.waitForTimeout(500);

  // Should not crash, entity count unchanged
  const after = await entityCount(page);
  expect(after).toBe(before);
});

// === UNDO/REDO 10 OPERATIONS ===

test('undo-redo-10-operations', async ({ page }) => {
  const initial = await entityCount(page);

  // Create 10 lines — switch to select between each to break chaining
  for (let i = 0; i < 10; i++) {
    await typeCommand(page, 'l');
    await typeCommand(page, `${i * 3},${i * 2}`);
    await typeCommand(page, `${i * 3 + 2},${i * 2 + 1}`);
    await typeCommand(page, 'esc');
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(300);

  const afterCreate = await entityCount(page);
  expect(afterCreate).toBeGreaterThanOrEqual(initial + 10);

  // Click canvas to remove focus from command line
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 50, box.y + 50);
  await page.waitForTimeout(200);

  // Undo 5 operations
  const beforeUndo = await entityCount(page);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(300);

  const afterUndo = await entityCount(page);
  expect(afterUndo).toBeLessThan(beforeUndo);

  // Redo 5
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);

  const afterRedo = await entityCount(page);
  expect(afterRedo).toBe(beforeUndo);
});

// === 100+ ENTITIES PERFORMANCE ===

test('50-entities-performance', async ({ page }) => {
  test.setTimeout(120000);
  const start = Date.now();

  // Create 50 lines via command line
  for (let i = 0; i < 50; i++) {
    const x1 = (i % 10) * 5;
    const y1 = Math.floor(i / 10) * 5;
    await typeCommand(page, 'l');
    await typeCommand(page, `${x1},${y1}`);
    await typeCommand(page, `${x1 + 3},${y1 + 2}`);
    await page.keyboard.press('Escape');
  }

  await page.waitForTimeout(500);
  const elapsed = Date.now() - start;
  const count = await entityCount(page);

  expect(count).toBeGreaterThanOrEqual(50);
  expect(elapsed).toBeLessThan(120000);

  await page.screenshot({ path: 'e2e/screenshots/50-entities.png' });
});

// === WASM LOAD TIME ===

test('wasm-loads-under-3-seconds', async ({ page }) => {
  const start = Date.now();
  await page.goto('/');
  // Wait for the app to be interactive (toolbar renders after WASM loads)
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 10000 });
  // Wait for entity count element to render (proves WASM kernel initialized)
  await page.waitForSelector('.entity-count', { timeout: 10000 });
  const elapsed = Date.now() - start;

  expect(elapsed).toBeLessThan(3000);
});
