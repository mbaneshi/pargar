// Regression coverage for #94 — the autocomplete dropdown overlapping the
// canvas no longer swallows pointer events that belong to a canvas drag.
//
// Design contract (see CommandLine.svelte `.autocomplete` rule and
// `class:interactive={suggestionNavigated}` binding):
//
//   - Default state (autocomplete shown reactively from typing, no keyboard
//     navigation yet): `pointer-events: none` so a canvas drag whose mouseup
//     happens to land inside the dropdown's screen rectangle passes through
//     to the renderer.
//   - Navigated state (`ArrowUp`/`ArrowDown` set `suggestionNavigated = true`):
//     pointer-events re-enabled so suggestions can be clicked.
//
// Note on hover-click without keyboard navigation: a CSS-only `:hover`
// re-enable does not work because `pointer-events: none` disables the
// hit-testing that drives `:hover`. The dropdown is therefore keyboard-first
// when shown reactively from typing — matching AutoCAD's command-line UX.

import { test, expect } from '@playwright/test';
import { dismissWelcome } from '../helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
});

test('drag-end mouseup passes through unhovered autocomplete to canvas', async ({ page }) => {
  await page.keyboard.press('/');
  await page.waitForTimeout(100);
  // Typing 'l' opens autocomplete with the LINE-family commands. We do NOT
  // press Arrow keys — `suggestionNavigated` stays false, so the dropdown
  // is in its default pointer-transparent state.
  await page.keyboard.type('l');
  await page.waitForTimeout(150);

  await expect(page.locator('.autocomplete')).toBeVisible();
  const autoBox = await page.locator('.autocomplete').boundingBox();
  const canvasBox = await page.locator('.canvas-container').boundingBox();
  if (!autoBox || !canvasBox) throw new Error('autocomplete or canvas not found');

  // Drag from upper canvas (clear of the dropdown) ending inside the
  // dropdown's screen rectangle. Without the fix, the mouseup would hit
  // the dropdown's `<button.suggestion>` and CadRenderer.onMouseUp would
  // never fire — leaving status at whatever it was before the drag.
  const startX = canvasBox.x + canvasBox.width / 2;
  const startY = canvasBox.y + canvasBox.height / 4;
  const endX = autoBox.x + autoBox.width / 2;
  const endY = autoBox.y + autoBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(300);

  // handleIdleDragEnd writes either "Selected: N entities (mode)" or
  // "Command:" — both indicate DRAG_END was dispatched. Anything else
  // (notably "Cancelled") would mean the dropdown trapped the mouseup.
  const status = await page.locator('.status-text').textContent();
  expect(status).toMatch(/Selected|Command/i);
  expect(status).not.toMatch(/Cancelled/i);
});

test('click on suggestion after keyboard navigation activates it', async ({ page }) => {
  await page.keyboard.press('/');
  await page.waitForTimeout(100);
  await page.keyboard.type('l');
  await page.waitForTimeout(150);

  await expect(page.locator('.autocomplete')).toBeVisible();
  // ArrowDown sets suggestionNavigated=true, which adds `.interactive` to
  // the autocomplete element and re-enables pointer-events on its subtree.
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);

  // The mousedown handler on `.suggestion` writes the command alias into
  // the input and hides the dropdown. After the click, the dropdown should
  // be gone and the input should contain a non-empty value.
  const selected = page.locator('.autocomplete .suggestion.selected').first();
  await selected.click();
  await page.waitForTimeout(200);

  await expect(page.locator('.autocomplete')).toHaveCount(0);
  const inputValue = await page.locator('#cmd-input').inputValue();
  expect(inputValue.length).toBeGreaterThan(0);
});

test('click on suggestion before keyboard navigation does not activate (keyboard-first)', async ({ page }) => {
  // Documents the design trade-off: in the default `pointer-events: none`
  // state, mouse clicks on suggestions are not honored. Users must press
  // ArrowUp/ArrowDown first to opt the dropdown into interactive mode.
  // If a future PR introduces hover-without-keyboard-nav re-enabling,
  // flip this assertion. See #94 for the full design discussion.
  await page.keyboard.press('/');
  await page.waitForTimeout(100);
  await page.keyboard.type('l');
  await page.waitForTimeout(150);

  await expect(page.locator('.autocomplete')).toBeVisible();

  // Try clicking the first suggestion WITHOUT keyboard nav. The mousedown
  // should not reach the `.suggestion` button — pointer-events: none on
  // the autocomplete subtree blocks the hit-test, so the existing onmousedown
  // handler does not fire. The dropdown should stay open.
  const first = page.locator('.autocomplete .suggestion').first();
  await first.click({ force: true }).catch(() => {
    // `click({ force: true })` skips actionability; if Playwright rejects it
    // anyway because of pointer-events: none, that's still a passing signal.
  });
  await page.waitForTimeout(200);

  // Dropdown still visible (the click was inert).
  await expect(page.locator('.autocomplete')).toBeVisible();
});
