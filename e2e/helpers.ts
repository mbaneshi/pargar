import type { Page } from '@playwright/test';

export async function dismissLogin(page: Page) {
  const guestBtn = page.locator('button', { hasText: 'Continue as Guest' });
  try {
    await guestBtn.waitFor({ state: 'visible', timeout: 3000 });
    await guestBtn.click();
    await guestBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  } catch {
    // No login overlay present
  }
}

export async function canvasBox(page: Page) {
  const box = await page.locator('.canvas-container').boundingBox();
  if (!box) throw new Error('Canvas container not found');
  return box;
}

export async function entityCount(page: Page): Promise<number> {
  const text = await page.locator('.entity-count').textContent();
  return parseInt(text?.match(/\d+/)?.[0] || '0');
}

export async function activateTool(page: Page, name: string) {
  // Plain tools render the label as button text. Split-tools (Circle, Rect,
  // Arc, Dim) render the current variant as text, so match the title prefix too.
  await page
    .locator(`.panel-buttons button:has-text("${name}"), .panel-buttons button[title^="${name}"]`)
    .first()
    .click();
  await page.waitForTimeout(200);
}

export async function selectRibbonTab(page: Page, label: string) {
  await page.locator('.ribbon .tab-btn', { hasText: label }).click();
  await page.waitForTimeout(200);
}

export async function typeCmd(page: Page, cmd: string) {
  const input = page.locator('#cmd-input');
  await input.click();
  await input.fill(cmd);
  await page.waitForTimeout(50);
  // CommandLine.handleSubmit only treats Enter as autocomplete-select when
  // suggestionNavigated is true (set by ArrowUp/Down). For typed input
  // without keyboard navigation, the first Enter submits — pressing a
  // second Enter fires onCommand('') against the now-active tool, which
  // can advance state machines (e.g. TRIM 2021+ default-all) or cancel
  // a tool waiting for an Enter at status > 0.
  await input.press('Enter');
  await page.waitForTimeout(200);
}

export async function dismissWelcome(page: Page, mode: 'new' | 'sample' = 'sample') {
  // First dismiss the login overlay if it's blocking
  await dismissLogin(page);

  const welcome = page.locator('[data-testid="welcome-screen"]');
  let welcomeVisible = false;
  try {
    await welcome.waitFor({ state: 'visible', timeout: 3000 });
    welcomeVisible = true;
  } catch {
    // No welcome screen — fall through to the post-condition wait below.
  }

  if (welcomeVisible) {
    if (mode === 'sample') {
      await page
        .locator('[data-testid="welcome-screen"] button', { hasText: 'Open Sample' })
        .click();
    } else {
      await page
        .locator('[data-testid="welcome-screen"] button', { hasText: 'New Drawing' })
        .click();
    }
    // Wait for welcome to disappear — it may trigger navigation
    try {
      await welcome.waitFor({ state: 'hidden', timeout: 5000 });
    } catch {
      // navigation-detach branch: post-condition wait below catches the
      // page-settle anyway. Just clean up if welcome re-appeared.
      const reappeared = await welcome.isVisible().catch(() => false);
      if (reappeared) {
        // Remove it via DOM as fallback
        await page.evaluate(() => {
          document.querySelector('[data-testid="welcome-screen"]')?.remove();
        });
        await page.waitForTimeout(300);
      }
    }
  }

  // Post-condition: the Ribbon has rendered, so the app is interactive.
  // Single end-of-helper wait subsumes the per-spec waitForSelector calls
  // that previously waited on the orphaned `[data-testid="toolbar"]`.
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 10000 });
}

export async function focusCanvas(page: Page) {
  const box = await canvasBox(page);
  await page.mouse.click(box.x + 50, box.y + 50);
  await page.waitForTimeout(200);
}

export async function drawLine(page: Page, x1: string, y1: string, x2: string, y2: string) {
  await typeCmd(page, 'l');
  await typeCmd(page, `${x1},${y1}`);
  await typeCmd(page, `${x2},${y2}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}
