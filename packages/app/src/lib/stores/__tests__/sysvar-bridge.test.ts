import { describe, it, expect } from 'vitest';
import {
  readSysvarInt,
  writeSysvarInt,
  snapEnabledFromOsmode,
  setSnapEnabledOnOsmode,
  modeFlagFromInt,
  setModeFlagOnInt,
  bitFromInt,
  setBitOnInt,
  type SysvarBridge,
} from '../sysvar-bridge';

class StubKernel implements SysvarBridge {
  store = new Map<string, string>();

  get_sysvar_typed_json(name: string): string {
    return this.store.get(name) ?? 'null';
  }

  set_sysvar_typed_json(name: string, value_json: string): boolean {
    this.store.set(name, value_json);
    return true;
  }
}

describe('readSysvarInt', () => {
  it('returns the Int payload from the kernel', () => {
    const k = new StubKernel();
    k.set_sysvar_typed_json('OSMODE', JSON.stringify({ Int: 4133 }));
    expect(readSysvarInt(k, 'OSMODE')).toBe(4133);
  });

  it('returns 0 when bridge is null', () => {
    expect(readSysvarInt(null, 'OSMODE')).toBe(0);
  });

  it('returns 0 when the variable is missing (json "null")', () => {
    const k = new StubKernel();
    expect(readSysvarInt(k, 'NOPE')).toBe(0);
  });

  it('returns 0 when the kernel returned a non-Int variant', () => {
    const k = new StubKernel();
    k.set_sysvar_typed_json('CLAYER', JSON.stringify({ String: '0' }));
    expect(readSysvarInt(k, 'CLAYER')).toBe(0);
  });

  it('returns 0 when the kernel returned malformed JSON (defensive)', () => {
    const k: SysvarBridge = {
      get_sysvar_typed_json: () => 'not json',
      set_sysvar_typed_json: () => true,
    };
    expect(readSysvarInt(k, 'X')).toBe(0);
  });
});

describe('writeSysvarInt', () => {
  it('emits the externally-tagged Int JSON shape the kernel expects', () => {
    const k = new StubKernel();
    expect(writeSysvarInt(k, 'OSMODE', 4133)).toBe(true);
    expect(k.store.get('OSMODE')).toBe(JSON.stringify({ Int: 4133 }));
  });

  it('is a no-op (returns false) when the bridge is null', () => {
    expect(writeSysvarInt(null, 'OSMODE', 1)).toBe(false);
  });
});

// ── Bit-fielded toggles ────────────────────────────────────────────────────

describe('snapEnabledFromOsmode / setSnapEnabledOnOsmode (OSMODE bit 16384)', () => {
  it('reports enabled when bit 16384 is clear', () => {
    expect(snapEnabledFromOsmode(4133)).toBe(true);
    expect(snapEnabledFromOsmode(0)).toBe(true);
  });

  it('reports disabled when bit 16384 is set', () => {
    expect(snapEnabledFromOsmode(4133 | 16384)).toBe(false);
    expect(snapEnabledFromOsmode(16384)).toBe(false);
  });

  it('clears bit 16384 when enabled and preserves the rest', () => {
    expect(setSnapEnabledOnOsmode(4133 | 16384, true)).toBe(4133);
    expect(setSnapEnabledOnOsmode(4133, true)).toBe(4133);
  });

  it('sets bit 16384 when disabled and preserves the rest', () => {
    expect(setSnapEnabledOnOsmode(4133, false)).toBe(4133 | 16384);
    expect(setSnapEnabledOnOsmode(16384, false)).toBe(16384);
  });
});

describe('modeFlagFromInt / setModeFlagOnInt (0/1 sysvars: SNAPMODE, GRIDMODE, ORTHOMODE, PSLTSCALE)', () => {
  it('treats any non-zero as enabled', () => {
    expect(modeFlagFromInt(1)).toBe(true);
    expect(modeFlagFromInt(2)).toBe(true);
    expect(modeFlagFromInt(0)).toBe(false);
  });

  it('coerces enabled to exactly 1, disabled to exactly 0', () => {
    expect(setModeFlagOnInt(true)).toBe(1);
    expect(setModeFlagOnInt(false)).toBe(0);
  });
});

describe('bitFromInt / setBitOnInt (AUTOSNAP bit 16 polar, bit 32 otrack)', () => {
  it('reports the bit set / clear state', () => {
    expect(bitFromInt(0b0001_0000, 16)).toBe(true);
    expect(bitFromInt(0b0010_0000, 16)).toBe(false);
    expect(bitFromInt(0b0011_0000, 16)).toBe(true);
    expect(bitFromInt(0b0011_0000, 32)).toBe(true);
  });

  it('sets the bit when enabling and clears when disabling, preserving siblings', () => {
    // Default AUTOSNAP = 63 (marker+magnet+tooltip+aperture+polar+otrack)
    expect(setBitOnInt(63, 16, false)).toBe(63 & ~16); // disable polar
    expect(setBitOnInt(63 & ~16, 16, true)).toBe(63);
    expect(setBitOnInt(63, 32, false)).toBe(63 & ~32); // disable otrack
    expect(setBitOnInt(0, 16, true)).toBe(16);
  });
});
