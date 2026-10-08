import { test, expect } from '@playwright/test';
import { dismissWelcome, selectRibbonTab } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(500);
});

async function openRibbonMenu(page: import('@playwright/test').Page) {
  await page.locator('.ribbon .tab-bar').click({ button: 'right' });
  const menu = page.locator('[data-testid="ribbon-context-menu"]');
  await expect(menu).toBeVisible();
  return menu;
}

test('right-click opens the ribbon customize menu', async ({ page }) => {
  const menu = await openRibbonMenu(page);
  await expect(menu.locator('.menu-section-label', { hasText: 'Tabs' })).toBeVisible();
  await expect(menu.locator('.menu-checkbox-row', { hasText: 'Home' })).toBeVisible();
});

test('hiding a tab removes it from the tab bar and persists across reload', async ({ page }) => {
  const menu = await openRibbonMenu(page);
  await menu.locator('.menu-checkbox-row', { hasText: 'Insert' }).locator('input').uncheck();
  await page.keyboard.press('Escape');

  await expect(page.locator('.ribbon .tab-btn', { hasText: 'Insert' })).toHaveCount(0);

  await page.reload();
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await expect(page.locator('.ribbon .tab-btn', { hasText: 'Insert' })).toHaveCount(0);
});

test('hiding a panel on the active tab persists across reload', async ({ page }) => {
  await selectRibbonTab(page, 'Home');
  const menu = await openRibbonMenu(page);
  await expect(menu.locator('.menu-section-label', { hasText: 'Panels (Home)' })).toBeVisible();
  await menu.locator('.menu-checkbox-row', { hasText: 'Modify' }).locator('input').uncheck();
  await page.keyboard.press('Escape');

  await expect(page.locator('.ribbon-panel', { hasText: 'Modify' })).toHaveCount(0);

  await page.reload();
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await selectRibbonTab(page, 'Home');
  await expect(page.locator('.ribbon-panel', { hasText: 'Modify' })).toHaveCount(0);
});

test('reset ribbon to default restores hidden tabs and panels, and persists', async ({
  page,
}) => {
  let menu = await openRibbonMenu(page);
  await menu.locator('.menu-checkbox-row', { hasText: 'Insert' }).locator('input').uncheck();
  await menu.locator('.menu-checkbox-row', { hasText: 'Modify' }).locator('input').uncheck();
  await page.keyboard.press('Escape');

  await expect(page.locator('.ribbon .tab-btn', { hasText: 'Insert' })).toHaveCount(0);

  menu = await openRibbonMenu(page);
  await menu.locator('.reset-btn', { hasText: 'Reset Ribbon to Default' }).click();

  await expect(menu).toBeHidden();
  await expect(page.locator('.ribbon .tab-btn', { hasText: 'Insert' })).toBeVisible();
  await expect(page.locator('.ribbon-panel', { hasText: 'Modify' })).toBeVisible();

  await page.reload();
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await expect(page.locator('.ribbon .tab-btn', { hasText: 'Insert' })).toBeVisible();
});

test('switching workspace does not lose hidden-tab state or offer workspace-excluded tabs', async ({
  page,
}) => {
  // The workspace <select> lives in StatusBar.svelte, not Ribbon.svelte —
  // target it via its `title` attribute rather than option text, since
  // Ribbon.svelte's own `.layer-dropdown` <select> is also on the page.
  const workspaceSelect = page.locator('select[title="Workspace"]');

  let menu = await openRibbonMenu(page);
  await menu.locator('.menu-checkbox-row', { hasText: 'Annotate' }).locator('input').uncheck();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ribbon .tab-btn', { hasText: 'Annotate' })).toHaveCount(0);

  // Switch to the "Minimal" workspace (home + view only — Annotate is
  // workspace-excluded there regardless of hidden state).
  await workspaceSelect.selectOption('minimal');
  menu = await openRibbonMenu(page);
  await expect(menu.locator('.menu-checkbox-row', { hasText: 'Insert' })).toHaveCount(0);
  await expect(menu.locator('.menu-checkbox-row', { hasText: 'Annotate' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Switch back to Full Interface — Annotate should still be hidden (user
  // choice), Insert should still be visible (never touched).
  await workspaceSelect.selectOption('full');
  await expect(page.locator('.ribbon .tab-btn', { hasText: 'Annotate' })).toHaveCount(0);
  await expect(page.locator('.ribbon .tab-btn', { hasText: 'Insert' })).toBeVisible();
});
