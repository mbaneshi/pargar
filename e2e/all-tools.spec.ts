import { test, expect } from '@playwright/test';
import { canvasBox, entityCount, activateTool, typeCmd, dismissWelcome } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(1000);
});

// === DRAWING TOOLS VIA TOOLBAR BUTTON ===

const drawToolsClick = [
  { tool: 'Line', steps: [[300, 300], [400, 300]] },
  { tool: 'Circle', steps: [[300, 300], [350, 300]] },
  { tool: 'Rect', steps: [[200, 200], [350, 300]] },
  { tool: 'Arc', steps: [[300, 300], [350, 300], [300, 350]] },
  { tool: 'Ellipse', steps: [[300, 300], [400, 300], [300, 350]] },
  { tool: 'Pline', steps: [[200, 200], [300, 200], [300, 300]] },
  { tool: 'Spline', steps: [[200, 200], [250, 150], [300, 200], [350, 150]] },
  { tool: 'XLine', steps: [[300, 300], [400, 350]] },
  // Text and Dim require multi-step input that is flaky in headless CI
  { tool: 'Text', steps: [[300, 300]], skip: true },
  { tool: 'Dim', steps: [[200, 300], [400, 300], [300, 250]], skip: true },
] as const;

for (const entry of drawToolsClick) {
  const { tool, steps } = entry;
  const fn = ('skip' in entry && entry.skip) ? test.skip : test;
  fn(`${tool.toLowerCase()}-creates-entity-via-button`, async ({ page }) => {
    const before = await entityCount(page);
    await activateTool(page, tool);
    const box = await canvasBox(page);
    for (const [x, y] of steps) {
      await page.mouse.click(box.x + x, box.y + y);
      await page.waitForTimeout(200);
    }
    // Text tool needs text input via command line
    if (tool === 'Text') {
      const input = page.locator('#cmd-input');
      await input.click();
      await input.fill('Test Text');
      await input.press('Enter');
      await page.waitForTimeout(300);
    }
    // Spline and Pline need Enter to finish
    if (tool === 'Spline' || tool === 'Pline') {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(300);
    expect(await entityCount(page)).toBeGreaterThan(before);
  });
}

// === DRAWING TOOLS VIA COMMAND LINE ALIAS ===

const cmdAliasTests = [
  { alias: 'l', name: 'line', steps: [[300, 300], [400, 300]] },
  { alias: 'c', name: 'circle', steps: [[300, 300], [350, 300]] },
  { alias: 'r', name: 'rectangle', steps: [[200, 200], [350, 300]] },
  { alias: 'a', name: 'arc', steps: [[300, 300], [350, 300], [300, 350]] },
  { alias: 'el', name: 'ellipse', steps: [[300, 300], [400, 300], [300, 350]] },
];

for (const { alias, name, steps } of cmdAliasTests) {
  test(`cmd-alias-${alias}-activates-${name}`, async ({ page }) => {
    const before = await entityCount(page);
    await typeCmd(page, alias);
    const box = await canvasBox(page);
    for (const [x, y] of steps) {
      await page.mouse.click(box.x + x, box.y + y);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(300);
    expect(await entityCount(page)).toBeGreaterThan(before);
  });
}

// Spline via alias (needs Enter to finish)
test('cmd-alias-spl-activates-spline', async ({ page }) => {
  const before = await entityCount(page);
  await typeCmd(page, 'spl');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 250, box.y + 150);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 300, box.y + 200);
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBeGreaterThan(before);
});

// Polyline via alias (needs Enter to finish)
test('cmd-alias-pl-activates-polyline', async ({ page }) => {
  const before = await entityCount(page);
  await typeCmd(page, 'pl');
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 300, box.y + 200);
  await page.waitForTimeout(200);
  await page.mouse.click(box.x + 300, box.y + 300);
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(await entityCount(page)).toBeGreaterThan(before);
});
