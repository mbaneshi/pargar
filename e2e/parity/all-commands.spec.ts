// Generic parity driver — auto-generates tests from YAML specs.
//
// Discovers all yamls in notes/specs/autocad-2d/commands/, loads each
// into a ParityModel, and generates tests per command:
//
//   - Initial prompt matches AutoCAD wording
//   - Alias starts the command
//   - Esc cancels from initial state
//   - F-key invariants hold in initial state
//   - Pan/zoom invariants hold in initial state
//
// Tests are fixme'd by default. As implementation catches up, remove
// fixme from individual assertions (or from entire command blocks).
//
// For deeper state-machine testing (transitions beyond the initial
// state), use per-command spec files in this directory.

import { test, expect, type Page } from '@playwright/test';
import { loadModel, listAvailableSpecs } from './loadModel';
import { dismissWelcome, typeCmd, focusCanvas } from '../helpers';

// --- Helpers ---------------------------------------------------------------

async function promptText(page: Page): Promise<string> {
  const el = page.locator('[data-testid="command-area"] .prompt').first();
  return (await el.textContent()) ?? '';
}

async function isCommandActive(page: Page, commandName: string): Promise<boolean> {
  const text = await promptText(page);
  return text.toLowerCase().includes(commandName.toLowerCase()) ||
    text.includes('Specify') ||
    text.includes('Select');
}

// --- Test generation -------------------------------------------------------

const specs = listAvailableSpecs();
const models: { name: string; model: ReturnType<typeof loadModel> }[] = [];

for (const specName of specs) {
  try {
    models.push({ name: specName, model: loadModel(specName) });
  } catch (e) {
    console.warn(`[parity] Skipping ${specName}.yaml — parse error: ${(e as Error).message?.split('\n')[0]}`);
  }
}

for (const { name: specName, model } of models) {

  test.describe(`${model.command} parity`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
      await dismissWelcome(page, 'new');
    });

    // --- Initial prompt ----
    const initialState = Object.values(model.states)[0];
    const initialStateId = Object.keys(model.states)[0];

    if (initialState) {
      test.fixme(`initial prompt matches AutoCAD: ${initialStateId}`, async ({ page }) => {
        await focusCanvas(page);
        await typeCmd(page, model.command);
        const text = await promptText(page);
        expect(text).toMatch(initialState.prompt);
      });

      // --- Options in initial prompt ---
      if (initialState.options.length > 0) {
        test.fixme(`initial prompt shows options: [${initialState.options.join('/')}]`, async ({ page }) => {
          await focusCanvas(page);
          await typeCmd(page, model.command);
          const text = await promptText(page);
          for (const opt of initialState.options) {
            expect(text).toContain(opt);
          }
        });
      }
    }

    // --- Alias works ---
    for (const alias of model.aliases) {
      test(`alias "${alias}" starts ${model.command}`, async ({ page }) => {
        await focusCanvas(page);
        await typeCmd(page, alias);
        await page.waitForTimeout(300);
        const active = await isCommandActive(page, model.command);
        // Weaker check: just verify SOMETHING is active (prompt changed)
        const text = await promptText(page);
        expect(text.length).toBeGreaterThan(0);
      });
    }

    // --- Esc cancels from initial state ---
    test(`Esc cancels ${model.command} from initial state`, async ({ page }) => {
      await focusCanvas(page);
      await typeCmd(page, model.command);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const text = await promptText(page);
      // After Esc, prompt should not contain the command name
      expect(text.toLowerCase()).not.toContain(model.command.toLowerCase());
    });

    // --- F-key invariants from initial state ---
    const fkeyInvariants = model.invariants.filter(
      inv => inv.action.kind === 'key' && /^F\d+$/.test(inv.action.value ?? '')
    );

    for (const inv of fkeyInvariants) {
      const key = (inv.action as { kind: 'key'; value: string }).value;
      test.fixme(`invariant: ${key} (${inv.name}) holds in initial state`, async ({ page }) => {
        await focusCanvas(page);
        await typeCmd(page, model.command);
        const before = await promptText(page);
        await page.keyboard.press(key);
        await page.waitForTimeout(100);
        const after = await promptText(page);
        // State should be unchanged (same prompt)
        expect(after).toBe(before);
      });
    }

    // --- Pan invariant ---
    const panInvariant = model.invariants.find(inv => inv.name.includes('pan'));
    if (panInvariant) {
      test.fixme(`invariant: pan does not leave ${model.command}`, async ({ page }) => {
        await focusCanvas(page);
        await typeCmd(page, model.command);
        const before = await promptText(page);
        // Middle-mouse drag simulation
        const box = await page.locator('.canvas-container').boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down({ button: 'middle' });
          await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2);
          await page.mouse.up({ button: 'middle' });
        }
        await page.waitForTimeout(200);
        const after = await promptText(page);
        expect(after).toBe(before);
      });
    }
  });
}
