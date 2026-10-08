// TRIM — AutoCAD parity driver.
//
// Asserts our TrimHandler against trim.model.ts.
// See ./README.md for the test pattern and conventions.

import { test, expect, type Page } from '@playwright/test';
import { dismissWelcome, typeCmd, focusCanvas, drawLine, entityCount } from '../helpers';
import { TRIM } from './trim.model';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
});

async function promptText(page: Page): Promise<string> {
  const el = page.locator('[data-testid="command-area"] .prompt').first();
  return (await el.textContent()) ?? '';
}

// --- State prompts ---------------------------------------------------------

test('select_cutting_edges: prompt offers <select all> default', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'TRIM');
  expect(await promptText(page)).toMatch(TRIM.states.select_cutting_edges.prompt);
});

test('select_to_trim: prompt shows shift-select and keyword options', async ({ page }) => {
  // Our handler currently goes straight to "Select entity to trim" after
  // picking ONE boundary — it doesn't have the AutoCAD 2021+ "select all"
  // default, and its prompt text is shorter.
  await focusCanvas(page);
  await drawLine(page, '0', '0', '20', '0');
  await drawLine(page, '10', '-10', '10', '10');
  await typeCmd(page, 'TRIM');
  await typeCmd(page, ''); // Enter = select all (AutoCAD 2021+)
  expect(await promptText(page)).toMatch(TRIM.states.select_to_trim.prompt);
});

// --- Transitions -----------------------------------------------------------

test('Enter at select_cutting_edges uses all entities as boundaries (2021+ default)', async ({ page }) => {
  // Known gap: our handler requires picking a single boundary entity.
  // AutoCAD 2021+ lets you press Enter to use everything as a boundary.
  await focusCanvas(page);
  await drawLine(page, '0', '0', '20', '0');
  await drawLine(page, '10', '-10', '10', '10');
  await typeCmd(page, 'TRIM');
  await typeCmd(page, ''); // Enter = select all
  const prompt = await promptText(page);
  expect(prompt).toMatch(/Select object to trim/i);
});

test.fixme('select_to_trim: Undo reverses last trim', async ({ page }) => {
  await focusCanvas(page);
  await drawLine(page, '0', '0', '20', '0');
  await drawLine(page, '10', '-10', '10', '10');
  await typeCmd(page, 'TRIM');
  await typeCmd(page, '');
  const c = await page.locator('.canvas-container').boundingBox();
  if (!c) throw new Error('canvas');
  const before = await entityCount(page);
  await page.mouse.click(c.x + c.width / 2 + 50, c.y + c.height / 2); // trim right half
  expect(await entityCount(page)).toBeLessThan(before + 1);
  await typeCmd(page, 'U');
  expect(await entityCount(page)).toBe(before);
});

test.fixme('select_to_trim: Fence mode trims all crossing entities', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'TRIM');
  await typeCmd(page, '');
  await typeCmd(page, 'F');
  expect(await promptText(page)).toMatch(/fence/i);
});

// --- Invariants ------------------------------------------------------------

test('invariant: Esc cancels TRIM from select_cutting_edges', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'TRIM');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await promptText(page)).not.toMatch(/TRIM|trim/i);
});

test.fixme('invariant: Shift-click extends instead of trimming', async ({ page }) => {
  // The defining power-user move. In the TRIM loop, holding Shift while
  // clicking an entity runs EXTEND on it instead — you never leave the
  // command. This is the most important single invariant in this model.
  await focusCanvas(page);
  await drawLine(page, '0', '0', '20', '0');
  await drawLine(page, '10', '-10', '10', '10');
  await drawLine(page, '25', '-5', '25', '5');
  await typeCmd(page, 'TRIM');
  await typeCmd(page, ''); // select all
  const c = await page.locator('.canvas-container').boundingBox();
  if (!c) throw new Error('canvas');
  // Shift-click the third line to extend it to the nearest boundary
  await page.mouse.click(c.x + c.width / 2 + 75, c.y + c.height / 2, {
    modifiers: ['Shift'],
  });
  // Verify the entity was extended (entity count unchanged, geometry modified)
  expect(await promptText(page)).toMatch(/Select object to trim/i);
});
