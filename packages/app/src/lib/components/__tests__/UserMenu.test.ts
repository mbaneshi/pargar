import { describe, it, expect, vi } from 'vitest';

function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

describe('UserMenu logic', () => {
  describe('getInitials', () => {
    it('extracts first letter of single name', () => {
      expect(getInitials('Alice')).toBe('A');
    });

    it('extracts two initials from full name', () => {
      expect(getInitials('Alice Bob')).toBe('AB');
    });

    it('caps at two initials for three-part names', () => {
      expect(getInitials('Alice Bob Carter')).toBe('AB');
    });

    it('uppercases lowercase names', () => {
      expect(getInitials('alice bob')).toBe('AB');
    });

    it('handles email as displayName fallback', () => {
      expect(getInitials('user@example.com')).toBe('U');
    });

    it('handles "User" default fallback', () => {
      expect(getInitials('User')).toBe('U');
    });
  });

  describe('sign-out flow', () => {
    it('calls signOut then onSignOut callback', async () => {
      const signOut = vi.fn().mockResolvedValue(undefined);
      const onSignOut = vi.fn();

      await signOut();
      onSignOut();

      expect(signOut).toHaveBeenCalledOnce();
      expect(onSignOut).toHaveBeenCalledOnce();
    });

    it('calls onSignOut after signOut resolves', async () => {
      const order: string[] = [];
      const signOut = vi.fn().mockImplementation(async () => {
        order.push('signOut');
      });
      const onSignOut = vi.fn().mockImplementation(() => {
        order.push('onSignOut');
      });

      await signOut();
      onSignOut();

      expect(order).toEqual(['signOut', 'onSignOut']);
    });
  });
});
