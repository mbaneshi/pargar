import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const url = import.meta.env.VITE_SUPABASE_URL;
export const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True if Supabase is configured well enough to attempt cloud features. */
export const cloudConfigured: boolean =
  typeof url === 'string' && url.length > 0 && typeof anonKey === 'string' && anonKey.length > 10;

let _client: SupabaseClient | null = null;

export function getClientLazy(): SupabaseClient | null {
  if (!cloudConfigured) return null;
  if (!_client) {
    try {
      _client = createClient(url, anonKey);
    } catch (err) {
      console.warn('[supabase] init failed:', err);
      return null;
    }
  }
  return _client;
}
