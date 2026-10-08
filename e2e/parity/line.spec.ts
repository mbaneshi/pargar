// LINE — AutoCAD parity driver.
//
// Asserts our LineHandler against line.model.ts.
// See ./README.md for the test pattern and conventions.

import { test, expect, type Page } from '@playwright/test';
import { dismissWelcome, typeCmd, focusCanvas, entityCount } from '../helpers';
import { LINE } from './line.model';

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

test('first_point: prompt matches AutoCAD wording', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'LINE');
  expect(await promptText(page)).toMatch(LINE.states.first_point.prompt);
});

test('next_point: prompt shows [Close/Undo] after 2+ segments', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'LINE');
  await typeCmd(page, '0,0');
  await typeCmd(page, '10,0');
  await typeCmd(page, '10,10');
  expect(await promptText(page)).toMatch(/Specify next point or \[Close\/Undo\]:/);
});

test('next_point: prompt shows [Undo] only after 1 segment', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'LINE');
  await typeCmd(page, '0,0');
  await typeCmd(page, '10,0');
  expect(await promptText(page)).toMatch(/Specify next point or \[Undo\]:/);
});

// --- Transitions -----------------------------------------------------------

test('first_point → next_point: coordinate input advances', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'L');
  await typeCmd(page, '0,0');
  // Should now be in next_point state — prompt changes from "start point" to "next point"
  expect(await promptText(page)).toMatch(/next point/i);
});

test('next_point → next_point: each point extends the chain', async ({ page }) => {
  await focusCanvas(page);
  const before = await entityCount(page);
  await typeCmd(page, 'L');
  await typeCmd(page, '0,0');
  await typeCmd(page, '10,0');
  await typeCmd(page, '10,10');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await entityCount(page)).toBe(before + 2);
});

test('next_point: Close keyword creates closing segment and ends', async ({ page }) => {
  await focusCanvas(page);
  const before = await entityCount(page);
  await typeCmd(page, 'L');
  await typeCmd(page, '0,0');
  await typeCmd(page, '10,0');
  await typeCmd(page, '10,10');
  await typeCmd(page, 'C');
  await page.waitForTimeout(200);
  // 3 segments: (0,0)→(10,0), (10,0)→(10,10), (10,10)→(0,0)
  expect(await entityCount(page)).toBe(before + 3);
  // Command should have ended
  expect(await promptText(page)).not.toMatch(/LINE/i);
});

test.fixme('next_point: Undo removes last segment', async ({ page }) => {
  await focusCanvas(page);
  const before = await entityCount(page);
  await typeCmd(page, 'L');
  await typeCmd(page, '0,0');
  await typeCmd(page, '10,0');
  await typeCmd(page, '10,10');
  await typeCmd(page, 'U');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  // After undo: only 1 segment remains
  expect(await entityCount(page)).toBe(before + 1);
});

test.fixme('next_point: relative @x,y input works', async ({ page }) => {
  await focusCanvas(page);
  const before = await entityCount(page);
  await typeCmd(page, 'L');
  await typeCmd(page, '0,0');
  await typeCmd(page, '@10,5');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await entityCount(page)).toBe(before + 1);
});

test.fixme('next_point: polar @d<a input works', async ({ page }) => {
  await focusCanvas(page);
  const before = await entityCount(page);
  await typeCmd(page, 'L');
  await typeCmd(page, '0,0');
  await typeCmd(page, '@20<45');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await entityCount(page)).toBe(before + 1);
});

test.fixme('Space/Enter on next_point ends the chain', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'L');
  await typeCmd(page, '0,0');
  await typeCmd(page, '10,0');
  await typeCmd(page, ''); // Enter
  await page.waitForTimeout(200);
  expect(await promptText(page)).not.toMatch(/LINE|next point/i);
});

// --- Invariants ------------------------------------------------------------

test('invariant: Esc cancels LINE from first_point', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'L');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await promptText(page)).not.toMatch(/LINE/i);
});

test('invariant: Esc cancels LINE from next_point', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'L');
  await typeCmd(page, '0,0');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await promptText(page)).not.toMatch(/LINE/i);
});
