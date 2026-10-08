import { getClientLazy, cloudConfigured, url, anonKey } from './supabase';
import {
  DEFAULT_AUTH_PROVIDERS,
  fetchAuthProviders,
  formatIranPhone,
  toIranE164,
  type AuthProviders,
} from './authProviders';
import type { User } from '@supabase/supabase-js';

export class AuthService {
  user: User | null = $state(null);
  loading: boolean = $state(true);
  error: string = $state('');
  /** Sign-in methods the backing Supabase has enabled (null until loaded). */
  providers: AuthProviders | null = $state(null);

  private unsubscribe: (() => void) | null = null;

  init() {
    if (!cloudConfigured) {
      this.loading = false;
      return;
    }
    void this.loadProviders();
    const client = getClientLazy();
    if (!client) {
      this.loading = false;
      return;
    }
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      this.user = session?.user ?? null;
      this.loading = false;
    });
    this.unsubscribe = () => subscription.unsubscribe();
  }

  destroy() {
    this.unsubscribe?.();
  }

  get isAuthenticated(): boolean {
    return this.user !== null;
  }

  get uid(): string | null {
    return this.user?.id ?? null;
  }

  /** The user's phone in local `09…` form, or '' (phone-OTP users have no email). */
  get phone(): string {
    return this.user?.phone ? formatIranPhone(this.user.phone) : '';
  }

  get displayName(): string {
    return (
      (this.user?.user_metadata?.full_name as string | undefined) ||
      this.user?.email ||
      this.phone ||
      'User'
    );
  }

  /** Read `/auth/v1/settings` so the login page shows only enabled providers. */
  async loadProviders(): Promise<AuthProviders> {
    this.providers = cloudConfigured
      ? await fetchAuthProviders(url, anonKey)
      : { ...DEFAULT_AUTH_PROVIDERS };
    return this.providers;
  }

  /** Step 1 of phone sign-in: SMS a one-time code. Returns the E.164 number used. */
  async sendPhoneOtp(rawPhone: string): Promise<string> {
    this.error = '';
    const phone = toIranE164(rawPhone);
    if (!phone) {
      this.error = 'Enter a valid Iranian mobile number, e.g. 09123456789';
      throw new Error(this.error);
    }
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');
    const { error } = await client.auth.signInWithOtp({ phone });
    if (error) {
      this.error = error.message;
      throw error;
    }
    return phone;
  }

  /** Step 2 of phone sign-in: verify the 6-digit SMS code (session arrives via onAuthStateChange). */
  async verifyPhoneOtp(phone: string, token: string): Promise<void> {
    this.error = '';
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');
    const { error } = await client.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) {
      this.error = error.message;
      throw error;
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.error = '';
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      this.error = error.message;
      throw error;
    }
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    this.error = '';
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      this.error = error.message;
      throw error;
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    this.error = '';
    const client = getClientLazy();
    if (!client) throw new Error('Cloud features unavailable — Supabase not configured');
    const { error } = await client.auth.signUp({ email, password });
    if (error) {
      this.error = error.message;
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const client = getClientLazy();
    if (!client) return;
    await client.auth.signOut();
  }
}
