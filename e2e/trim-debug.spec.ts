import { test, expect } from '@playwright/test';
import { dismissWelcome, typeCmd, focusCanvas } from './helpers';

test('debug: empty Enter dispatches during TRIM', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="ribbon"]', { timeout: 15000 });
  await dismissWelcome(page, 'new');
  await focusCanvas(page);
  
  // Start TRIM
  await typeCmd(page, 'tr');
  
  // Check initial state
  const prompt1 = await page.locator('[data-testid="command-area"] .prompt').first().textContent();
  console.log('After TRIM start:', JSON.stringify(prompt1));
  
  // Try empty Enter via keyboard directly on the input
  const input = page.locator('#cmd-input');
  await input.click();
  await page.waitForTimeout(100);
  await input.press('Enter');
  await page.waitForTimeout(500);
  
  // Check if state advanced
  const prompt2 = await page.locator('[data-testid="command-area"] .prompt').first().textContent();
  console.log('After Enter:', JSON.stringify(prompt2));
  
  // The prompt should have changed from cutting-edges to trim-mode
  expect(prompt2).not.toBe(prompt1);
});
