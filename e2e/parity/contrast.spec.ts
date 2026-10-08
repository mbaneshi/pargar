import { test, expect } from '@playwright/test';
import { dismissLogin, dismissWelcome } from '../helpers';

// P1-2 — Ribbon category labels (DRAW / MOVE / MODIFY) must clear WCAG AA
// contrast (≥ 4.5:1 for body text). Sprint-2 verification measured #666 on
// #1e1e1e at 9px — failing.

function relLum(rgb: { r: number; g: number; b: number }) {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function parseRgb(s: string): { r: number; g: number; b: number } {
  const m = s.match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (!m) throw new Error(`Cannot parse color: ${s}`);
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function contrast(a: string, b: string) {
  const la = relLum(parseRgb(a));
  const lb = relLum(parseRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

test.describe('P1-2 — Ribbon category label contrast', () => {
  test('panel-label clears WCAG AA (≥ 4.5:1) against its background', async ({ page }) => {
    await page.goto('/');
    await dismissLogin(page);
    await dismissWelcome(page, 'new');

    const label = page.locator('.panel-label').first();
    await label.waitFor({ state: 'visible' });

    const colors = await label.evaluate((el) => {
      const fg = getComputedStyle(el).color;
      let parent: HTMLElement | null = el as HTMLElement;
      let bg = 'rgba(0, 0, 0, 0)';
      while (parent) {
        const c = getComputedStyle(parent).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
          bg = c;
          break;
        }
        parent = parent.parentElement;
      }
      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      return { fg, bg, fontSize };
    });

    const ratio = contrast(colors.fg, colors.bg);
    expect(
      ratio,
      `panel-label fg=${colors.fg} bg=${colors.bg} fontSize=${colors.fontSize}px ratio=${ratio.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(4.5);
    // Also check the font-size is at least 11px — 9px is below ergonomic minimum
    // even when contrast technically passes.
    expect(colors.fontSize).toBeGreaterThanOrEqual(11);
  });
});
