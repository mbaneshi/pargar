// S4-A — Snap/Grid status-bar toggles wire to kernel sysvars.
//
// Pure-UI behavioural test: clicks each status-bar toggle and asserts the
// `active` class flips. Kernel-side correctness (OSMODE bit 16384,
// SNAPMODE 0/1, GRIDMODE 0/1, ORTHOMODE 0/1, AUTOSNAP bits 16/32) is
// covered by:
//   - packages/app/src/lib/stores/__tests__/sysvar-bridge.test.ts (pure helpers)
//   - packages/kernel/src/sysvars.rs (default registry + serde shape)
//   - packages/kernel/src/dispatch.rs (Command::SetSysvarTyped/GetSysvarTyped)
// The PASS condition here is: the AppState getter/setter shim survives
// real WASM kernel boot and toggle clicks update the rendered button.

import { test, expect } from '@playwright/test';
import { dismissWelcome } from '../helpers';

test.describe('S4-A: status-bar toggles ↔ kernel sysvars (UI-level)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login + welcome overlays both sit above the status bar and intercept
    // clicks; a blank drawing is the right fixture for pure toggle tests.
    await dismissWelcome(page, 'new');
    // Wait for kernel boot: the OSNAP toggle activates only once
    // app.kernel is non-null and the getter resolves to true.
    await page
      .locator('button[title="Object Snap (F3)"]')
      .waitFor({ state: 'visible', timeout: 15_000 });
  });

  test('OSNAP toggle (F3) flips the active class on click', async ({ page }) => {
    const button = page.locator('button[title="Object Snap (F3)"]');
    await expect(button).toHaveClass(/active/);
    await button.click();
    await expect(button).not.toHaveClass(/active/);
    await button.click();
    await expect(button).toHaveClass(/active/);
  });

  test('SNAP toggle (F9) flips the active class on click', async ({ page }) => {
    const button = page.locator('button[title^="Grid Snap"]');
    const wasActive = await button.evaluate((el) =>
      el.classList.contains('active'),
    );
    await button.click();
    const nowActive = await button.evaluate((el) =>
      el.classList.contains('active'),
    );
    expect(nowActive).toBe(!wasActive);
  });

  test('ORTHO toggle (F8) flips the active class on click', async ({ page }) => {
    const button = page.locator('button[title^="Ortho"]');
    const wasActive = await button.evaluate((el) =>
      el.classList.contains('active'),
    );
    await button.click();
    const nowActive = await button.evaluate((el) =>
      el.classList.contains('active'),
    );
    expect(nowActive).toBe(!wasActive);
  });

  test('GRID toggle (F7) flips the active class on click', async ({ page }) => {
    const button = page.locator('button[title^="Grid (F7)"]');
    const wasActive = await button.evaluate((el) =>
      el.classList.contains('active'),
    );
    await button.click();
    const nowActive = await button.evaluate((el) =>
      el.classList.contains('active'),
    );
    expect(nowActive).toBe(!wasActive);
  });

  test('No console errors during the full toggle dance', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    for (const sel of [
      'button[title="Object Snap (F3)"]',
      'button[title^="Grid Snap"]',
      'button[title^="Ortho"]',
      'button[title^="Polar Tracking"]',
      'button[title^="Object Snap Tracking"]',
      'button[title^="Grid (F7)"]',
    ]) {
      await page.locator(sel).click();
      await page.locator(sel).click();
    }

    expect(errors.filter((e) => !e.includes('Firebase'))).toEqual([]);
  });
});
