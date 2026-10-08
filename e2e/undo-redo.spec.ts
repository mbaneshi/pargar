import { test, expect } from '@playwright/test';
import { entityCount, typeCmd, drawLine, dismissWelcome, focusCanvas } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(1000);
});

test('undo-removes-entity-after-draw', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  expect(await entityCount(page)).toBe(1);

  await focusCanvas(page);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBe(0);
});

test('redo-restores-undone-entity', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  expect(await entityCount(page)).toBe(1);

  await focusCanvas(page);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBe(0);

  await page.keyboard.press('Control+y');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBe(1);
});

test('redo-via-ctrl-shift-z', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  expect(await entityCount(page)).toBe(1);

  await focusCanvas(page);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBe(0);

  await page.keyboard.press('Control+Shift+z');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBe(1);
});

test('multiple-undo-redo-sequence', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  await drawLine(page, '10', '0', '20', '0');
  await drawLine(page, '20', '0', '30', '0');
  expect(await entityCount(page)).toBe(3);

  await focusCanvas(page);

  // Undo twice: 3 -> 2 -> 1
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBe(1);

  // Redo once: 1 -> 2
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBe(2);
});

test('undo-via-command-alias-u', async ({ page }) => {
  await drawLine(page, '0', '0', '10', '0');
  expect(await entityCount(page)).toBe(1);

  await typeCmd(page, 'u');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBe(0);
});
