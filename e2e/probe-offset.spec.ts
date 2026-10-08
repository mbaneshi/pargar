/**
 * OFFSET runtime probe — captures what the running app actually does,
 * for the three-way diff in notes/gaps/offset.md.
 *
 * Emits a JSON trace per assertion bucket so the gap report can cite
 * concrete observed behavior, not code-read inference.
 *
 * Run with:  pnpm exec playwright test e2e/probe-offset.spec.ts
 * Output:    notes/runtime-traces/offset.trace.json (written by the test on pass or fail)
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { canvasBox, dismissWelcome, drawLine, typeCmd } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TRACE_PATH = path.resolve(__dirname, '../notes/runtime-traces/offset.trace.json');

type Observation = {
  id: string;
  stage: string;
  expected: string;
  observed: string | null;
  verdict: 'match' | 'mismatch' | 'absent';
  evidence?: Record<string, unknown>;
};

const trace: Observation[] = [];

function record(obs: Observation) {
  trace.push(obs);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
});

test.afterAll(async () => {
  fs.mkdirSync(path.dirname(TRACE_PATH), { recursive: true });
  fs.writeFileSync(TRACE_PATH, JSON.stringify(trace, null, 2));
});

test('probe: alias O activates OFFSET', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  const prompt = await page.locator('.status-text, [data-testid="prompt"]').first().textContent();
  const observed = prompt?.trim() ?? null;
  record({
    id: 'alias-O',
    stage: 'command-activation',
    expected: 'Prompt begins with OFFSET and requests distance',
    observed,
    verdict: observed?.toUpperCase().includes('OFFSET') ? 'match' : 'mismatch',
  });
  expect(observed).toBeTruthy();
});

test('probe: distance prompt wording', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  const prompt = await page.locator('.status-text').first().textContent();
  const observed = prompt?.trim() ?? null;
  const expected = 'Specify offset distance or [Through/Erase/Layer] <LAST>:';
  record({
    id: 'distance-prompt-wording',
    stage: 'distance-prompt',
    expected,
    observed,
    verdict:
      observed?.includes('Through') && observed?.includes('Erase') && observed?.includes('Layer')
        ? 'match'
        : 'mismatch',
    evidence: { hasThrough: !!observed?.includes('Through') },
  });
});

test('probe: Through option at distance prompt', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  await typeCmd(page, 'T');
  const prompt = await page.locator('.status-text').first().textContent();
  const observed = prompt?.trim() ?? null;
  record({
    id: 'option-Through',
    stage: 'distance-prompt-option',
    expected: 'Prompt advances to select-object in Through mode',
    observed,
    verdict: observed?.toLowerCase().includes('select') ? 'match' : 'absent',
  });
});

test('probe: Erase option at distance prompt', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  await typeCmd(page, 'E');
  const prompt = await page.locator('.status-text').first().textContent();
  record({
    id: 'option-Erase',
    stage: 'distance-prompt-option',
    expected: 'Erase toggle sub-prompt appears',
    observed: prompt?.trim() ?? null,
    verdict: prompt?.toLowerCase().includes('erase') ? 'match' : 'absent',
  });
});

test('probe: Layer option at distance prompt', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  await typeCmd(page, 'L');
  const prompt = await page.locator('.status-text').first().textContent();
  record({
    id: 'option-Layer',
    stage: 'distance-prompt-option',
    expected: 'Layer choice sub-prompt appears (Current/Source)',
    observed: prompt?.trim() ?? null,
    verdict:
      prompt?.toLowerCase().includes('current') || prompt?.toLowerCase().includes('source')
        ? 'match'
        : 'absent',
  });
});

test('probe: distance default recall — typing distance once, Enter second time reuses it', async ({
  page,
}) => {
  await drawLine(page, '0', '0', '100', '0');
  // First invocation with explicit distance
  await typeCmd(page, 'o');
  await typeCmd(page, '25');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  // Second invocation — distance prompt should show <25> default
  await typeCmd(page, 'o');
  const prompt = await page.locator('.status-text').first().textContent();
  record({
    id: 'distance-recall',
    stage: 'distance-prompt',
    expected: 'Prompt shows <25> (OFFSETDIST) as default',
    observed: prompt?.trim() ?? null,
    verdict: prompt?.includes('25') || prompt?.includes('<') ? 'match' : 'absent',
  });
});

test('probe: side-pick prompt after selecting entity', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  await typeCmd(page, '10');
  const box = await canvasBox(page);
  // Click near the line to select it
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const prompt = await page.locator('.status-text').first().textContent();
  record({
    id: 'side-pick-prompt',
    stage: 'after-object-selection',
    expected: 'Prompt asks "Specify point on side to offset or [Exit/Multiple/Undo] <Exit>:"',
    observed: prompt?.trim() ?? null,
    verdict:
      prompt?.toLowerCase().includes('side') || prompt?.toLowerCase().includes('multiple')
        ? 'match'
        : 'absent',
  });
});

test('probe: Escape once exits OFFSET (AutoCAD semantics)', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  await typeCmd(page, '10');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const prompt = await page.locator('.status-text').first().textContent();
  const stillInTool = prompt?.toUpperCase().includes('OFFSET') ?? false;
  record({
    id: 'esc-once-exits',
    stage: 'cancel-semantics',
    expected: 'Single Escape exits OFFSET — prompt returns to idle/command-ready state',
    observed: prompt?.trim() ?? null,
    verdict: stillInTool ? 'mismatch' : 'match',
    evidence: { stillInTool },
  });
});

test('probe: F8 mid-command toggles ortho without exiting OFFSET', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  await typeCmd(page, '10');
  // Move mouse into canvas so F8 is received by the canvas
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('F8');
  await page.waitForTimeout(150);
  const prompt = await page.locator('.status-text').first().textContent();
  const stillInTool = prompt?.toUpperCase().includes('OFFSET') ?? false;
  record({
    id: 'f8-modeless',
    stage: 'modeless-during-command',
    expected: 'F8 toggles ORTHO, OFFSET remains active',
    observed: prompt?.trim() ?? null,
    verdict: stillInTool ? 'match' : 'mismatch',
    evidence: { stillInTool },
  });
});

test('probe: wheel-zoom mid-command does not exit OFFSET', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  await typeCmd(page, '10');
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(150);
  const prompt = await page.locator('.status-text').first().textContent();
  const stillInTool = prompt?.toUpperCase().includes('OFFSET') ?? false;
  record({
    id: 'wheel-zoom-modeless',
    stage: 'modeless-during-command',
    expected: 'Wheel-zoom zooms around cursor; OFFSET remains active',
    observed: prompt?.trim() ?? null,
    verdict: stillInTool ? 'match' : 'mismatch',
  });
});

test('probe: Space-repeats-last-command after OFFSET ends', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  await typeCmd(page, '10');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  // Now space in empty command line should repeat OFFSET
  const input = page.locator('#cmd-input');
  await input.click();
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const prompt = await page.locator('.status-text').first().textContent();
  record({
    id: 'space-repeats',
    stage: 'repeat-semantics',
    expected: 'Space/Enter at idle command line repeats the last command (OFFSET)',
    observed: prompt?.trim() ?? null,
    verdict: prompt?.toUpperCase().includes('OFFSET') ? 'match' : 'absent',
  });
});

test('probe: right-click during OFFSET shows context menu', async ({ page }) => {
  await drawLine(page, '0', '0', '100', '0');
  await typeCmd(page, 'o');
  await typeCmd(page, '10');
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await page.waitForTimeout(200);
  const menu = page
    .locator('[data-testid="context-menu"], .context-menu, [role="menu"]')
    .first();
  const menuVisible = await menu.isVisible().catch(() => false);
  record({
    id: 'right-click-context-menu',
    stage: 'context-aware-ui',
    expected: 'Context menu appears with Enter/Cancel/Recent/Zoom/Pan',
    observed: menuVisible ? 'menu visible' : 'no menu visible',
    verdict: menuVisible ? 'match' : 'absent',
  });
});
