// OFFSET — AutoCAD parity driver.
//
// Asserts our implementation (packages/app/src/lib/shell/tools/OffsetHandler.ts)
// against offset.model.ts (which projects notes/specs/autocad-2d/commands/offset.yaml).
//
// Tests marked `test.fixme` are KNOWN GAPS. Do NOT fix by weakening the
// assertion — fix by bringing the implementation toward AutoCAD. When a gap
// closes, remove the `.fixme` so the test becomes a regression guard.

import { test, expect, type Page } from '@playwright/test';
import { dismissWelcome, typeCmd, focusCanvas, drawLine } from '../helpers';
import { OFFSET } from './offset.model';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
});

async function promptText(page: Page): Promise<string> {
  const el = page.locator('[data-testid="command-area"] .prompt').first();
  return (await el.textContent()) ?? '';
}

async function orthoPressed(page: Page): Promise<string | null> {
  return page.locator('[data-testid="ortho-toggle"]').getAttribute('aria-pressed');
}

async function canvasCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.canvas-container').boundingBox();
  if (!box) throw new Error('canvas not found');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// --- State prompts ---------------------------------------------------------

test.fixme('distance_or_option: prompt shows [Through/Erase/Layer] + <OFFSETDIST> default', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  expect(await promptText(page)).toMatch(OFFSET.states.distance_or_option.prompt);
});

test('select_object: prompt shows [Exit/Undo] + <Exit> default', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, '250');
  expect(await promptText(page)).toMatch(OFFSET.states.select_object.prompt);
});

test('select_side: prompt shows [Exit/Multiple/Undo] + <Exit> default', async ({ page }) => {
  await focusCanvas(page);
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, '25');
  const c = await canvasCenter(page);
  await page.mouse.click(c.x, c.y);
  expect(await promptText(page)).toMatch(OFFSET.states.select_side.prompt);
});

// --- Transitions -----------------------------------------------------------

test('distance_or_option → select_object: numeric distance advances', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, '250');
  // Weaker assertion than the fixme above; takes over once the stricter one is green.
  expect(await promptText(page)).toMatch(/Select/i);
});

test.fixme('distance_or_option → select_object: Enter alone uses OFFSETDIST default', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, ''); // Enter with no input
  expect(await promptText(page)).toMatch(OFFSET.states.select_object.prompt);
});

test.fixme('distance_or_option → select_object_through: T enters through mode', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, 'T');
  expect(await promptText(page)).toMatch(OFFSET.states.select_object_through.prompt);
});

test.fixme('distance_or_option → erase_toggle: E opens erase sub-prompt', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, 'E');
  expect(await promptText(page)).toMatch(OFFSET.states.erase_toggle.prompt);
});

test.fixme('distance_or_option → layer_choice: L opens layer sub-prompt', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, 'L');
  expect(await promptText(page)).toMatch(OFFSET.states.layer_choice.prompt);
});

test('select_object → select_side: picking an object asks which side', async ({ page }) => {
  await focusCanvas(page);
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, '25');
  const c = await canvasCenter(page);
  await page.mouse.click(c.x, c.y);
  await page.waitForTimeout(300);
  expect(await promptText(page)).toMatch(OFFSET.states.select_side.prompt);
});

test.fixme('select_side → select_object: side-click applies offset and loops', async ({ page }) => {
  await focusCanvas(page);
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, '25');
  const c = await canvasCenter(page);
  await page.mouse.click(c.x, c.y);        // pick object
  await page.mouse.click(c.x, c.y - 50);   // pick side
  expect(await promptText(page)).toMatch(OFFSET.states.select_object.prompt);
});

// --- Invariants ------------------------------------------------------------

test('invariant: Esc cancels from distance_or_option', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect((await promptText(page)).toLowerCase()).not.toContain('offset');
});

test('invariant: Esc cancels from select_object', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, '250');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect((await promptText(page)).toLowerCase()).not.toContain('offset');
});

test.fixme('invariant: F8 toggles ortho while staying in select_object', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'OFFSET');
  await typeCmd(page, '250');
  const before = await orthoPressed(page);
  await page.keyboard.press('F8');
  await page.waitForTimeout(100);
  const after = await orthoPressed(page);
  expect(after).not.toBe(before);
  expect(await promptText(page)).toMatch(OFFSET.states.select_object.prompt);
});
