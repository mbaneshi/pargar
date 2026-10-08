/**
 * TRIM runtime probe — captures actual app behavior for three-way diff.
 * Run: pnpm exec playwright test e2e/probe-trim.spec.ts
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { canvasBox, dismissWelcome, drawLine, typeCmd } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TRACE_PATH = path.resolve(__dirname, '../notes/runtime-traces/trim.trace.json');

type Observation = {
  id: string;
  stage: string;
  expected: string;
  observed: string | null;
  verdict: 'match' | 'mismatch' | 'absent';
  evidence?: Record<string, unknown>;
};

const trace: Observation[] = [];
function record(obs: Observation) { trace.push(obs); }

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
});

test.afterAll(async () => {
  fs.mkdirSync(path.dirname(TRACE_PATH), { recursive: true });
  fs.writeFileSync(TRACE_PATH, JSON.stringify(trace, null, 2));
});

// Draw a cross for trim tests: horizontal + vertical lines intersecting at center
async function drawCross(page: any) {
  await drawLine(page, '0', '50', '100', '50');   // horizontal
  await drawLine(page, '50', '0', '50', '100');   // vertical
}

test('probe: alias TR activates TRIM', async ({ page }) => {
  await drawCross(page);
  await typeCmd(page, 'tr');
  const prompt = await page.locator('.status-text').first().textContent();
  const upper = prompt?.toUpperCase() ?? '';
  record({
    id: 'alias-TR',
    stage: 'command-activation',
    expected: 'TRIM prompt appears',
    observed: prompt?.trim() ?? null,
    verdict: (upper.includes('TRIM') || upper.includes('CUTTING') || upper.includes('SELECT')) ? 'match' : 'mismatch',
  });
  // The prompt shows TRIM-specific content (e.g. "Select cutting edges" or "Select objects")
  expect(upper.includes('TRIM') || upper.includes('CUTTING') || upper.includes('SELECT')).toBe(true);
});

test('probe: Quick mode — no cutting-edge prompt, immediate trim', async ({ page }) => {
  await drawCross(page);
  await typeCmd(page, 'tr');
  const prompt = await page.locator('.status-text').first().textContent();
  // AutoCAD 2021+ Quick mode goes straight to "Select object to trim"
  // NEXUS goes to "Select cutting edge" — which is Standard mode
  const isQuickMode = !(prompt?.toLowerCase().includes('cutting') || prompt?.toLowerCase().includes('edge'));
  record({
    id: 'quick-mode-default',
    stage: 'mode-selection',
    expected: 'Quick mode: prompt says "Select object to trim" without cutting-edge step',
    observed: prompt?.trim() ?? null,
    verdict: isQuickMode ? 'match' : 'absent',
    evidence: { isQuickMode },
  });
});

test('probe: cutting-edge prompt options [Fence/Crossing/Project/Edge/eRase/Undo]', async ({ page }) => {
  await drawCross(page);
  await typeCmd(page, 'tr');
  const prompt = await page.locator('.status-text').first().textContent();
  const hasOptions = ['Fence', 'Crossing', 'Project', 'Edge', 'eRase', 'Undo']
    .filter(opt => prompt?.includes(opt));
  record({
    id: 'trim-options-in-prompt',
    stage: 'object-selection',
    expected: 'Options: Fence, Crossing, Project, Edge, eRase, Undo shown in prompt',
    observed: prompt?.trim() ?? null,
    verdict: hasOptions.length >= 4 ? 'match' : 'absent',
    evidence: { foundOptions: hasOptions },
  });
});

test('probe: Enter at cutting-edge selects all (implicit cutting edges)', async ({ page }) => {
  await drawCross(page);
  await typeCmd(page, 'tr');
  // Press Enter without selecting a cutting edge — should select all edges
  const input = page.locator('#cmd-input');
  await input.click();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const prompt = await page.locator('.status-text').first().textContent();
  // Should advance to "select object to trim"
  const advanced = prompt?.toLowerCase().includes('trim') && !prompt?.toLowerCase().includes('cutting');
  record({
    id: 'enter-selects-all-edges',
    stage: 'cutting-edge-selection',
    expected: 'Enter at cutting-edge prompt selects all objects as edges, advances to trim',
    observed: prompt?.trim() ?? null,
    verdict: advanced ? 'match' : 'absent',
  });
});

test('probe: shift-click extends instead of trims', async ({ page }) => {
  await drawCross(page);
  await typeCmd(page, 'tr');
  const box = await canvasBox(page);
  // Select cutting edge
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
  await page.waitForTimeout(200);
  // Shift-click on an entity to extend it
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + box.width / 2 + 30, box.y + box.height / 2);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(200);
  const prompt = await page.locator('.status-text').first().textContent();
  record({
    id: 'shift-to-extend',
    stage: 'bidirectional-gesture',
    expected: 'Shift-click inverts TRIM → EXTEND on the picked entity',
    observed: prompt?.trim() ?? null,
    verdict: 'absent',  // will be verified by entity geometry change
    evidence: { note: 'Cannot determine from prompt alone; needs entity geometry check' },
  });
});

test('probe: within-command Undo (U)', async ({ page }) => {
  await drawCross(page);
  await typeCmd(page, 'tr');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
  await page.waitForTimeout(200);
  // Trim something
  await page.mouse.click(box.x + box.width / 2 + 30, box.y + box.height / 2);
  await page.waitForTimeout(200);
  // Try typing U to undo
  await typeCmd(page, 'U');
  const prompt = await page.locator('.status-text').first().textContent();
  const stillInTrim = prompt?.toUpperCase().includes('TRIM') ?? false;
  record({
    id: 'within-command-undo',
    stage: 'undo-semantics',
    expected: 'U reverses last trim; stays in TRIM command',
    observed: prompt?.trim() ?? null,
    verdict: stillInTrim ? 'match' : 'absent',
    evidence: { stillInTrim },
  });
});

test('probe: Esc exits TRIM (not reset to cutting-edge)', async ({ page }) => {
  await drawCross(page);
  await typeCmd(page, 'tr');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const prompt = await page.locator('.status-text').first().textContent();
  const stillInTool = prompt?.toUpperCase().includes('TRIM') ?? false;
  record({
    id: 'esc-exits-trim',
    stage: 'cancel-semantics',
    expected: 'Esc exits TRIM — prompt returns to idle',
    observed: prompt?.trim() ?? null,
    verdict: stillInTool ? 'mismatch' : 'match',
    evidence: { stillInTool },
  });
});

test('probe: F8 mid-TRIM toggles ortho without exiting', async ({ page }) => {
  await drawCross(page);
  await typeCmd(page, 'tr');
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press('F8');
  await page.waitForTimeout(150);
  const prompt = await page.locator('.status-text').first().textContent();
  const stillInTool = prompt?.toUpperCase().includes('TRIM') ?? false;
  record({
    id: 'f8-modeless-trim',
    stage: 'modeless-during-command',
    expected: 'F8 toggles ortho; TRIM remains active',
    observed: prompt?.trim() ?? null,
    verdict: stillInTool ? 'match' : 'mismatch',
  });
});
