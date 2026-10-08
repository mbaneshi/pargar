import { test, expect } from '@playwright/test';
import { dismissLogin, dismissWelcome } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissLogin(page);
});

test('welcome screen shows on first load', async ({ page }) => {
  const welcome = page.locator('[data-testid="welcome-screen"]');
  await expect(welcome).toBeVisible();
});

test('welcome screen dismiss on New Drawing', async ({ page }) => {
  const welcome = page.locator('[data-testid="welcome-screen"]');
  await expect(welcome).toBeVisible();
  await page.locator('[data-testid="welcome-screen"] button', { hasText: 'New Drawing' }).click();
  await expect(welcome).not.toBeVisible();
});

test('welcome screen Open Sample loads entities', async ({ page }) => {
  await page.locator('[data-testid="welcome-screen"] button', { hasText: 'Open Sample' }).click();
  await page.waitForTimeout(500);
  const countText = await page.locator('.entity-count').textContent();
  const count = parseInt(countText?.match(/\d+/)?.[0] || '0');
  expect(count).toBeGreaterThan(10);
});

test('project browser opens from File menu', async ({ page }) => {
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(300);

  await page.locator('.menu-trigger', { hasText: 'File' }).click();
  await page.waitForTimeout(200);

  await page.locator('.dropdown button', { hasText: 'Browse Projects' }).click();
  await page.waitForTimeout(300);

  const browser = page.locator('[data-testid="project-browser"]');
  await expect(browser).toBeVisible();
});

test('project browser shows empty state', async ({ page }) => {
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(300);

  await page.locator('.menu-trigger', { hasText: 'File' }).click();
  await page.waitForTimeout(200);
  await page.locator('.dropdown button', { hasText: 'Browse Projects' }).click();
  await page.waitForTimeout(300);

  const browser = page.locator('[data-testid="project-browser"]');
  await expect(browser).toBeVisible();
  const header = browser.locator('h2', { hasText: 'Projects' });
  await expect(header).toBeVisible();
});

test('project browser closes on overlay click', async ({ page }) => {
  await dismissWelcome(page, 'new');
  await page.waitForTimeout(300);

  await page.locator('.menu-trigger', { hasText: 'File' }).click();
  await page.waitForTimeout(200);
  await page.locator('.dropdown button', { hasText: 'Browse Projects' }).click();
  await page.waitForTimeout(300);

  const browser = page.locator('[data-testid="project-browser"]');
  await expect(browser).toBeVisible();

  // Click the close button
  await browser.locator('.close').click();
  await expect(browser).not.toBeVisible();
});
