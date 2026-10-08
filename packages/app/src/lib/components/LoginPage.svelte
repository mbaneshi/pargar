<script lang="ts">
  import type { AuthService } from '$lib/cloud/auth.svelte';
  import { formatIranPhone, normalizeDigits } from '$lib/cloud/authProviders';

  let {
    authService,
    onGuest,
  }: {
    authService: AuthService;
    onGuest: () => void;
  } = $props();

  let mode = $state<'signin' | 'signup'>('signin');
  let email = $state('');
  let password = $state('');
  let busy = $state(false);

  // Phone + SMS OTP (shown when the Supabase has `phone` enabled, e.g. the Iran build)
  let phoneInput = $state('');
  let otpPhone = $state(''); // E.164 number the code was sent to; '' = not sent yet
  let otpCode = $state('');

  // Only offer what the backing Supabase actually has enabled (GET /auth/v1/settings).
  let providers = $derived(authService.providers);
  let showEmail = $derived(!!providers?.email);
  let showGoogle = $derived(!!providers?.google);
  let showPhone = $derived(!!providers?.phone);
  let noProviders = $derived(!!providers && !showEmail && !showGoogle && !showPhone);

  async function handleGoogle() {
    busy = true;
    try {
      await authService.signInWithGoogle();
    } catch {
      // error is set on authService
    }
    busy = false;
  }

  async function handleEmail() {
    if (!email || !password) return;
    busy = true;
    try {
      if (mode === 'signup') {
        await authService.signUp(email, password);
      } else {
        await authService.signInWithEmail(email, password);
      }
    } catch {
      // error is set on authService
    }
    busy = false;
  }

  async function handleSendOtp() {
    if (!phoneInput) return;
    busy = true;
    try {
      otpPhone = await authService.sendPhoneOtp(phoneInput);
      otpCode = '';
    } catch {
      // error is set on authService
    }
    busy = false;
  }

  async function handleVerifyOtp() {
    const code = normalizeDigits(otpCode);
    if (!/^\d{6}$/.test(code)) {
      authService.error = 'Enter the 6-digit code from the SMS';
      return;
    }
    busy = true;
    try {
      await authService.verifyPhoneOtp(otpPhone, code);
    } catch {
      // error is set on authService
    }
    busy = false;
  }

  function changeNumber() {
    otpPhone = '';
    otpCode = '';
    authService.error = '';
  }
</script>

<div class="overlay">
  <div class="card">
    <div class="logo">NEXUS</div>
    <h1>{mode === 'signup' && showEmail && !showPhone ? 'Create Account' : 'Sign In'}</h1>
    <p>Browser-native 2D drafting — save your work to the cloud.</p>

    {#if !providers}
      <div class="status">Loading sign-in options…</div>
    {/if}

    {#if showPhone}
      {#if !otpPhone}
        <form
          onsubmit={(e) => {
            e.preventDefault();
            handleSendOtp();
          }}
        >
          <input
            class="ltr"
            type="tel"
            inputmode="tel"
            placeholder="Mobile number (09123456789)"
            bind:value={phoneInput}
            disabled={busy}
            autocomplete="tel"
          />
          <button type="submit" class="primary" disabled={busy || !phoneInput}> Send code </button>
        </form>
      {:else}
        <div class="status">
          Enter the 6-digit code sent to <span class="ltr">{formatIranPhone(otpPhone)}</span>
        </div>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            handleVerifyOtp();
          }}
        >
          <input
            class="ltr"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="6-digit code"
            bind:value={otpCode}
            disabled={busy}
            autocomplete="one-time-code"
          />
          <button type="submit" class="primary" disabled={busy || !otpCode}>
            Verify and sign in
          </button>
        </form>
        <div class="toggle">
          <button class="link" onclick={handleSendOtp} disabled={busy}>Resend code</button>
          <button class="link" onclick={changeNumber} disabled={busy}>Change number</button>
        </div>
      {/if}
    {/if}

    {#if showPhone && (showGoogle || showEmail)}
      <div class="divider"><span>or</span></div>
    {/if}

    {#if showGoogle}
      <button class="google-btn" onclick={handleGoogle} disabled={busy}>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Sign in with Google
      </button>
    {/if}

    {#if showGoogle && showEmail}
      <div class="divider"><span>or</span></div>
    {/if}

    {#if showEmail}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleEmail();
        }}
      >
        <input
          type="email"
          placeholder="Email"
          bind:value={email}
          disabled={busy}
          autocomplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          bind:value={password}
          disabled={busy}
          autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
        <button type="submit" class="primary" disabled={busy || !email || !password}>
          {mode === 'signup' ? 'Create Account' : 'Sign In'}
        </button>
      </form>
    {/if}

    {#if noProviders}
      <div class="status">Sign-in is not available right now.</div>
    {/if}

    {#if authService.error}
      <div class="error">{authService.error}</div>
    {/if}

    {#if showEmail}
      <div class="toggle">
        {#if mode === 'signin'}
          <span>No account?</span>
          <button class="link" onclick={() => (mode = 'signup')}>Create one</button>
        {:else}
          <span>Have an account?</span>
          <button class="link" onclick={() => (mode = 'signin')}>Sign in</button>
        {/if}
      </div>
    {/if}

    <button class="guest-btn" onclick={onGuest} disabled={busy}> Continue as Guest </button>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-welcome);
  }

  .card {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-input);
    border-radius: var(--radius-3xl);
    padding: var(--space-4xl) 48px;
    text-align: center;
    width: 380px;
    box-shadow: var(--shadow-card);
  }

  .logo {
    font-weight: 700;
    font-size: 2rem;
    color: var(--color-accent);
    letter-spacing: 4px;
    margin-bottom: var(--space-md);
  }

  h1 {
    margin: 0 0 var(--space-md);
    font-size: 1.2rem;
    color: var(--color-text-heading);
    font-weight: 500;
  }

  p {
    margin: 0 0 var(--space-3xl);
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    width: 100%;
    padding: 10px;
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border-menu);
    background: var(--color-bg-input);
    color: var(--color-text-primary);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 500;
  }
  .google-btn:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }

  .divider {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    margin: var(--space-xl) 0;
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    border-top: 1px solid var(--color-border-light);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  input {
    padding: 10px var(--space-lg);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border-input);
    background: var(--color-bg-input);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
  }
  input:focus {
    border-color: var(--color-accent);
  }

  .primary {
    padding: 10px;
    border-radius: var(--radius-xl);
    border: none;
    background: var(--color-accent);
    color: var(--color-text-bright);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 500;
  }
  .primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
  .primary:disabled,
  .google-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    margin-top: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-md);
    background: rgba(233, 69, 96, 0.15);
    color: var(--color-danger);
    font-size: 0.78rem;
    text-align: left;
  }

  .toggle {
    margin-top: var(--space-xl);
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }

  .link {
    background: none;
    border: none;
    color: var(--color-link);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0;
    margin-left: var(--space-sm);
  }
  .link:hover {
    color: var(--color-link-hover);
  }

  .status {
    margin: 0 0 var(--space-md);
    color: var(--color-text-secondary);
    font-size: 0.8rem;
  }

  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }

  .toggle .link + .link {
    margin-left: var(--space-lg);
  }

  .guest-btn {
    margin-top: var(--space-xl);
    padding: 8px var(--space-xl);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border-light);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
  }
  .guest-btn:hover:not(:disabled) {
    color: var(--color-text-primary);
    border-color: var(--color-border-menu);
  }

  @media (max-width: 480px) {
    .card {
      width: calc(100% - var(--space-xl));
      margin: var(--space-md);
      padding: var(--space-3xl) var(--space-xl);
      border-radius: var(--radius-2xl);
    }
    .logo {
      font-size: 1.5rem;
    }
    h1 {
      font-size: 1rem;
    }
  }
</style>
