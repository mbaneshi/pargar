import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_AUTH_PROVIDERS,
  fetchAuthProviders,
  formatIranPhone,
  normalizeDigits,
  parseAuthSettings,
  toIranE164,
} from '../authProviders';

describe('toIranE164', () => {
  it.each([
    ['09177171260', '+989177171260'],
    ['9177171260', '+989177171260'],
    ['989177171260', '+989177171260'],
    ['+989177171260', '+989177171260'],
    ['00989177171260', '+989177171260'],
    ['0917 717 1260', '+989177171260'],
    ['0917-717-1260', '+989177171260'],
    ['۰۹۱۷۷۱۷۱۲۶۰', '+989177171260'],
    ['٠٩١٧٧١٧١٢٦٠', '+989177171260'],
  ])('normalizes %s', (input, expected) => {
    expect(toIranE164(input)).toBe(expected);
  });

  it.each(['', '0917717126', '091771712600', '02112345678', '+14155552671', 'abc', '08177171260'])(
    'rejects %s',
    (input) => {
      expect(toIranE164(input)).toBeNull();
    },
  );
});

describe('formatIranPhone', () => {
  it('shows E.164 as local 09…', () => {
    expect(formatIranPhone('+989177171260')).toBe('09177171260');
  });
  it('handles GoTrue stored form without plus', () => {
    expect(formatIranPhone('989177171260')).toBe('09177171260');
  });
  it('passes non-Iranian numbers through', () => {
    expect(formatIranPhone('+14155552671')).toBe('+14155552671');
  });
});

describe('normalizeDigits', () => {
  it('converts Persian digits and strips separators', () => {
    expect(normalizeDigits(' ۱۲ ۳-(۴) ')).toBe('1234');
  });
});

describe('parseAuthSettings', () => {
  it('phone-only server: only phone enabled', () => {
    expect(
      parseAuthSettings({
        external: { phone: true, email: false, google: false, github: false },
        disable_signup: false,
      }),
    ).toEqual({ google: false, email: false, phone: true });
  });

  it('USA-style: google + email enabled', () => {
    expect(parseAuthSettings({ external: { google: true, email: true, phone: false } })).toEqual({
      google: true,
      email: true,
      phone: false,
    });
  });

  it('treats missing / non-boolean flags as disabled', () => {
    expect(parseAuthSettings({ external: { google: 'yes' } })).toEqual({
      google: false,
      email: false,
      phone: false,
    });
  });

  it('falls back to defaults on malformed payload', () => {
    expect(parseAuthSettings(null)).toEqual(DEFAULT_AUTH_PROVIDERS);
    expect(parseAuthSettings({ nope: 1 })).toEqual(DEFAULT_AUTH_PROVIDERS);
  });
});

describe('fetchAuthProviders', () => {
  it('calls /auth/v1/settings with the anon apikey', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ external: { phone: true, email: false, google: false } }), {
          status: 200,
        }),
    );
    const p = await fetchAuthProviders('https://supabase.example/', 'anon-key', fetchFn);
    expect(p).toEqual({ google: false, email: false, phone: true });
    expect(fetchFn).toHaveBeenCalledWith('https://supabase.example/auth/v1/settings', {
      headers: { apikey: 'anon-key' },
    });
  });

  it('falls back to defaults on HTTP error', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    expect(await fetchAuthProviders('https://x', 'k', fetchFn)).toEqual(DEFAULT_AUTH_PROVIDERS);
  });

  it('falls back to defaults on network error', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('network');
    });
    expect(await fetchAuthProviders('https://x', 'k', fetchFn)).toEqual(DEFAULT_AUTH_PROVIDERS);
  });
});
