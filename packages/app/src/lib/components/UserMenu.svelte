<script lang="ts">
  import type { AuthService } from '$lib/cloud/auth.svelte';

  let { authService, onSignOut }: { authService: AuthService; onSignOut: () => void } = $props();

  let open = $state(false);

  let initials = $derived(
    authService.displayName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2),
  );

  let photoURL = $derived(
    (authService.user?.user_metadata?.avatar_url as string | undefined) ?? null,
  );

  let photoFailed = $state(false);

  $effect(() => {
    void photoURL;
    photoFailed = false;
  });

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function close() {
    open = false;
  }

  async function handleSignOut() {
    open = false;
    await authService.signOut();
    onSignOut();
  }
</script>

<svelte:window onclick={close} />

<div class="user-menu">
  <button class="trigger" onclick={toggle} title={authService.displayName}>
    {#if photoURL && !photoFailed}
      <img
        class="avatar"
        src={photoURL}
        alt={authService.displayName}
        referrerpolicy="no-referrer"
        onerror={() => (photoFailed = true)}
      />
    {:else}
      <span class="avatar initials">{initials}</span>
    {/if}
    <span class="chevron">{open ? '\u25B4' : '\u25BE'}</span>
  </button>

  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dropdown" onclick={(e) => e.stopPropagation()}>
      <div class="user-info">
        <span class="name">{authService.displayName}</span>
        {#if authService.user?.email}
          <span class="email">{authService.user.email}</span>
        {:else if authService.phone && authService.phone !== authService.displayName}
          <span class="email phone">{authService.phone}</span>
        {/if}
      </div>
      <div class="divider"></div>
      <button class="menu-item" onclick={handleSignOut}>Sign Out</button>
    </div>
  {/if}
</div>

<style>
  .user-menu {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-right: var(--space-md);
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-xs);
    border-radius: var(--radius-sm);
  }

  .trigger:hover {
    background: var(--color-bg-hover);
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
  }

  .initials {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-accent);
    color: #fff;
    font-size: var(--font-size-xs);
    font-weight: 600;
    font-family: inherit;
  }

  .chevron {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  .dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--space-xs);
    min-width: 200px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 1000;
  }

  .user-info {
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .phone {
    direction: ltr;
    unicode-bidi: isolate;
  }

  .email {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .divider {
    height: 1px;
    background: var(--color-border);
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: none;
    border: none;
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .menu-item:hover {
    background: var(--color-bg-hover);
  }
</style>
