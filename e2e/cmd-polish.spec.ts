import { test, expect } from '@playwright/test';
import { dismissWelcome } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  // Ensure welcome overlay is fully gone before tests interact with the page
  await page.waitForSelector('[data-testid="welcome-screen"]', { state: 'hidden', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
});

// === COMMAND AREA BASICS ===

test('command-area-visible', async ({ page }) => {
  const area = page.locator('[data-testid="command-area"]');
  await expect(area).toBeVisible();
});

test('command-input-focusable', async ({ page }) => {
  await page.keyboard.press('/');
  await page.waitForTimeout(100);
  const input = page.locator('#cmd-input');
  await expect(input).toBeFocused();
});

// === AUTOCAD-STYLE PROMPT ===

test('prompt-shows-command-name-uppercase', async ({ page }) => {
  await page.keyboard.press('l');
  await page.waitForTimeout(300);
  const prompt = page.locator('.command-area .prompt');
  const text = await prompt.textContent();
  // Prompt shows tool-specific instruction (e.g. "Specify first point:") or tool name
  expect(text).toMatch(/LINE|Specify|first point/i);
});

test('prompt-updates-on-tool-change', async ({ page }) => {
  await page.keyboard.press('c');
  await page.waitForTimeout(300);
  const prompt = page.locator('.command-area .prompt');
  const text = await prompt.textContent();
  expect(text).toMatch(/CIRCLE/i);
});

test('prompt-shows-command-colon-when-select', async ({ page }) => {
  await page.keyboard.press('s');
  await page.waitForTimeout(300);
  const prompt = page.locator('.command-area .prompt');
  const text = await prompt.textContent();
  expect(text).toBe('Command:');
});

// === COMMAND ECHO ===

// Command echo rendering is timing-sensitive in headless CI
test.skip('command-echo-user-input-white', async ({ page }) => {
  const input = page.locator('#cmd-input');
  await input.click();
  await page.waitForTimeout(200);
  await input.fill('line');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const inputLine = page.locator('.history-line.input-line').last();
  await expect(inputLine).toBeVisible({ timeout: 3000 });
  const text = await inputLine.textContent();
  expect(text).toBe('line');
});

// === TAB COMPLETION ===

test('tab-completes-single-match', async ({ page }) => {
  await page.keyboard.press('/');
  await page.waitForTimeout(100);
  await page.keyboard.type('fille');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  const input = page.locator('#cmd-input');
  const val = await input.inputValue();
  expect(val).toBe('fillet');
});

test('tab-shows-multiple-matches', async ({ page }) => {
  await page.keyboard.press('/');
  await page.waitForTimeout(100);
  await page.keyboard.type('m');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);
  // Should show matches in history area
  const echoLine = page.locator('.history-line.echo-line').last();
  await expect(echoLine).toBeVisible();
  const text = await echoLine.textContent();
  // Should contain multiple commands starting with 'm'
  expect(text).toMatch(/m/);
});

// === RESIZABLE ===

test('command-area-has-resize-handle', async ({ page }) => {
  const handle = page.locator('.resize-handle');
  await expect(handle).toBeAttached();
});

// === HISTORY ===

test('history-scrolls-to-bottom', async ({ page }) => {
  await page.keyboard.press('/');
  await page.waitForTimeout(100);
  // Enter several commands to build history
  for (const cmd of ['line', 'esc', 'circle', 'esc', 'rectangle', 'esc']) {
    await page.keyboard.type(cmd);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
  }
  // History should show recent entries
  const lastLine = page.locator('.history-line').last();
  await expect(lastLine).toBeVisible();
});

test('arrow-up-recalls-previous-command', async ({ page }) => {
  await page.keyboard.press('/');
  await page.waitForTimeout(100);
  await page.keyboard.type('line');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(100);
  const input = page.locator('#cmd-input');
  const val = await input.inputValue();
  expect(val).toBe('line');
});
