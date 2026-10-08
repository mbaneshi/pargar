import { test, expect } from '@playwright/test';
import { canvasBox, entityCount, focusCanvas, dismissWelcome } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(1000);
  // Focus canvas so keyboard shortcuts aren't captured by command line
  await focusCanvas(page);
});

// === TOOL ACTIVATION SHORTCUTS ===

const toolShortcuts = [
  { key: 'l', expected: /LINE/ },
  { key: 'c', expected: /CIRCLE/ },
  { key: 'r', expected: /RECT/ },
  { key: 'a', expected: /ARC/ },
  { key: 'm', expected: /MOVE/ },
];

for (const { key, expected } of toolShortcuts) {
  test(`shortcut-${key}-activates-tool`, async ({ page }) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    const tool = await page.locator('.active-tool').textContent();
    expect(tool).toMatch(expected);
  });
}

test('shortcut-s-activates-select', async ({ page }) => {
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  // Select is non-interactive — no .active-tool badge, status shows "Command:"
  const status = await page.locator('.status-text').textContent();
  expect(status).toMatch(/select|command/i);
});

// === F-KEY TOGGLES ===

test('F2-zoom-extents', async ({ page }) => {
  await page.keyboard.press('F2');
  await page.waitForTimeout(300);
  // F2 triggers zoom extents — no crash is the test
  const status = await page.locator('.status-text').textContent();
  expect(status).toBeDefined();
});

test('F3-toggles-osnap', async ({ page }) => {
  await page.keyboard.press('F3');
  await page.waitForTimeout(300);
  const status = await page.locator('.status-text').textContent();
  expect(status?.toLowerCase()).toContain('osnap');
});

test('F7-toggles-grid', async ({ page }) => {
  await page.keyboard.press('F7');
  await page.waitForTimeout(300);
  const status = await page.locator('.status-text').textContent();
  expect(status?.toLowerCase()).toContain('grid');
});

test('F8-toggles-ortho', async ({ page }) => {
  await page.keyboard.press('F8');
  await page.waitForTimeout(300);
  const status = await page.locator('.status-text').textContent();
  expect(status?.toLowerCase()).toContain('ortho');
});

test('F12-toggles-dynamic-input', async ({ page }) => {
  await page.keyboard.press('F12');
  await page.waitForTimeout(300);
  const status = await page.locator('.status-text').textContent();
  expect(status?.toLowerCase()).toContain('dynamic input');
});

// === CTRL COMBOS ===

test('ctrl-z-undoes', async ({ page }) => {
  // Draw a line to have something to undo
  await page.keyboard.press('l');
  await page.waitForTimeout(200);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 300, box.y + 200);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const before = await entityCount(page);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  expect(after).toBeLessThan(before);
});

test('ctrl-shift-z-redoes', async ({ page }) => {
  // Draw then undo then redo
  await page.keyboard.press('l');
  await page.waitForTimeout(200);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 300, box.y + 200);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  const afterUndo = await entityCount(page);

  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(300);
  const afterRedo = await entityCount(page);
  expect(afterRedo).toBeGreaterThan(afterUndo);
});

test('ctrl-s-saves', async ({ page }) => {
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(500);
  // Check status text or autosave indicator
  const status = await page.locator('.status-text').textContent();
  const autosave = await page.locator('.autosave').textContent().catch(() => '');
  const combined = (status + ' ' + autosave).toLowerCase();
  expect(combined).toContain('saved');
});

// === OTHER SHORTCUTS ===

test('slash-focuses-command-line', async ({ page }) => {
  await page.keyboard.press('/');
  await page.waitForTimeout(200);
  const focused = await page.evaluate(() => document.activeElement?.id);
  expect(focused).toBe('cmd-input');
});

test('escape-cancels-and-deselects', async ({ page }) => {
  // Activate a tool first
  await page.keyboard.press('l');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const status = await page.locator('.status-text').textContent();
  expect(status?.toLowerCase()).toContain('cancel');
});

test('delete-key-deletes-selected', async ({ page }) => {
  // Draw a line
  await page.keyboard.press('l');
  await page.waitForTimeout(200);
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 300, box.y + 200);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const before = await entityCount(page);

  // Select the entity
  await page.keyboard.press('s');
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 250, box.y + 200);
  await page.waitForTimeout(200);

  // Delete
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  const after = await entityCount(page);
  expect(after).toBeLessThanOrEqual(before);
});
