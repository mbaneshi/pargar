// CIRCLE — AutoCAD parity driver.
//
// Asserts our CircleHandler against circle.model.ts.
// See ./README.md for the test pattern and conventions.

import { test, expect, type Page } from '@playwright/test';
import { dismissWelcome, typeCmd, focusCanvas, entityCount } from '../helpers';
import { CIRCLE } from './circle.model';

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

test('center_point: prompt shows [3P/2P/Ttr]', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'CIRCLE');
  expect(await promptText(page)).toMatch(CIRCLE.states.center_point.prompt);
});

test('radius: prompt shows [Diameter] option', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'CIRCLE');
  await typeCmd(page, '0,0');
  expect(await promptText(page)).toMatch(CIRCLE.states.radius.prompt);
});

// --- Transitions: center + radius (happy path) ----------------------------

test('center_point → radius: coordinate input advances', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'C');
  await typeCmd(page, '0,0');
  expect(await promptText(page)).toMatch(/radius/i);
});

test('radius → done: numeric radius creates circle', async ({ page }) => {
  await focusCanvas(page);
  const before = await entityCount(page);
  await typeCmd(page, 'C');
  await typeCmd(page, '0,0');
  await typeCmd(page, '25');
  await page.waitForTimeout(200);
  expect(await entityCount(page)).toBe(before + 1);
});

// --- Transitions: diameter mode -------------------------------------------

test('radius → diameter: D keyword switches to diameter mode', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'C');
  await typeCmd(page, '0,0');
  await typeCmd(page, 'D');
  expect(await promptText(page)).toMatch(CIRCLE.states.diameter.prompt);
});

test('diameter → done: numeric diameter creates circle (radius = value/2)', async ({ page }) => {
  await focusCanvas(page);
  const before = await entityCount(page);
  await typeCmd(page, 'C');
  await typeCmd(page, '0,0');
  await typeCmd(page, 'D');
  await typeCmd(page, '50');
  await page.waitForTimeout(200);
  expect(await entityCount(page)).toBe(before + 1);
});

// --- Transitions: alternate entry modes (all fixme — not implemented) ------

test.fixme('center_point → 3P: keyword 3P enters 3-point mode', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'C');
  await typeCmd(page, '3P');
  expect(await promptText(page)).toMatch(CIRCLE.states.three_point_first.prompt);
});

test.fixme('center_point → 2P: keyword 2P enters 2-point mode', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'C');
  await typeCmd(page, '2P');
  expect(await promptText(page)).toMatch(CIRCLE.states.two_point_first.prompt);
});

test.fixme('center_point → Ttr: keyword T enters tangent-tangent-radius mode', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'C');
  await typeCmd(page, 'T');
  expect(await promptText(page)).toMatch(CIRCLE.states.ttr_first_tangent.prompt);
});

// --- Invariants ------------------------------------------------------------

test('invariant: Esc cancels CIRCLE from center_point', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'C');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await promptText(page)).not.toMatch(/CIRCLE|circle/i);
});

test('invariant: Esc cancels CIRCLE from radius', async ({ page }) => {
  await focusCanvas(page);
  await typeCmd(page, 'C');
  await typeCmd(page, '0,0');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(await promptText(page)).not.toMatch(/CIRCLE|circle/i);
});
