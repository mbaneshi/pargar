/**
 * Which sign-in methods to offer, and Iranian phone-number helpers.
 *
 * The provider list is read at runtime from GoTrue's public settings endpoint
 * (`GET {SUPABASE_URL}/auth/v1/settings`, anon key is enough), so each build
 * shows exactly what its own Supabase has enabled — no per-deploy flag:
 *   - USA Supabase (google + email on)  → Google button + email/password form
 *   - phone-only Supabase (e.g. cad.houshkar.ir) → phone + SMS OTP form
 * Pure functions here; the fetch is injectable for tests.
 */

export interface AuthProviders {
  google: boolean;
  email: boolean;
  phone: boolean;
}

/** Used when the settings endpoint can't be read — the historical UI. */
export const DEFAULT_AUTH_PROVIDERS: AuthProviders = Object.freeze({
  google: true,
  email: true,
  phone: false,
});

/** Map GoTrue's `/auth/v1/settings` JSON to the providers this app supports. */
export function parseAuthSettings(json: unknown): AuthProviders {
  const external =
    json && typeof json === 'object' && 'external' in json
      ? (json as { external: unknown }).external
      : null;
  if (!external || typeof external !== 'object') return { ...DEFAULT_AUTH_PROVIDERS };
  const ext = external as Record<string, unknown>;
  return {
    google: ext.google === true,
    email: ext.email === true,
    phone: ext.phone === true,
  };
}

/** Fetch the enabled providers; falls back to DEFAULT_AUTH_PROVIDERS on any failure. */
export async function fetchAuthProviders(
  supabaseUrl: string,
  anonKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<AuthProviders> {
  try {
    const res = await fetchFn(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    if (!res.ok) return { ...DEFAULT_AUTH_PROVIDERS };
    return parseAuthSettings(await res.json());
  } catch {
    return { ...DEFAULT_AUTH_PROVIDERS };
  }
}

/** Persian (۰-۹) and Arabic-Indic (٠-٩) digits → ASCII; strips spaces, dashes, parens. */
export function normalizeDigits(input: string): string {
  return String(input ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s\-()]/g, '');
}

/**
 * Iranian mobile → E.164 (`+989xxxxxxxxx`), which GoTrue requires.
 * Accepts `09xxxxxxxxx`, `9xxxxxxxxx`, `989xxxxxxxxx`, `+989xxxxxxxxx`, `00989…`,
 * with Persian/Arabic digits. Returns null for anything that isn't an Iranian mobile.
 */
export function toIranE164(input: string): string | null {
  let d = normalizeDigits(input);
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('98')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return /^9\d{9}$/.test(d) ? `+98${d}` : null;
}

/** E.164 (`+989…` or GoTrue's stored `989…`) → local `09…` for display. Other numbers pass through. */
export function formatIranPhone(phone: string): string {
  const d = normalizeDigits(phone).replace(/^\+/, '');
  return /^989\d{9}$/.test(d) ? `0${d.slice(2)}` : phone;
}
