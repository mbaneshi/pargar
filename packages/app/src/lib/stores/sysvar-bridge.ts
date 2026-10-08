/**
 * Pure helpers for talking to the kernel sysvar registry from the UI shell.
 *
 * These functions are intentionally Svelte-rune-free so they're testable
 * without the Svelte compiler. AppState wraps them in getter/setter pairs
 * that fronted the 5 status-bar toggles before S4-A (snapEnabled,
 * gridSnapEnabled, gridEnabled, orthoMode, polarEnabled, otrackEnabled).
 */

export interface SysvarBridge {
  get_sysvar_typed_json(name: string): string;
  set_sysvar_typed_json(name: string, value_json: string): boolean;
}

/** Read an Int-typed sysvar. Returns 0 on missing var, wrong type, or bridge null. */
export function readSysvarInt(bridge: SysvarBridge | null, name: string): number {
  if (!bridge) return 0;
  let parsed: unknown;
  try {
    parsed = JSON.parse(bridge.get_sysvar_typed_json(name));
  } catch {
    return 0;
  }
  if (parsed && typeof parsed === 'object' && 'Int' in parsed) {
    const v = (parsed as { Int: unknown }).Int;
    return typeof v === 'number' ? v : 0;
  }
  return 0;
}

/** Write an Int-typed sysvar. Returns false if the bridge is null. */
export function writeSysvarInt(bridge: SysvarBridge | null, name: string, value: number): boolean {
  if (!bridge) return false;
  return bridge.set_sysvar_typed_json(name, JSON.stringify({ Int: value }));
}

// AutoCAD's OSMODE bit 16384 = "running OSNAP off" flag (cleared = OSNAP active).
const OSMODE_DISABLE_BIT = 16384;

export function snapEnabledFromOsmode(osmode: number): boolean {
  return (osmode & OSMODE_DISABLE_BIT) === 0;
}

export function setSnapEnabledOnOsmode(osmode: number, enabled: boolean): number {
  return enabled ? osmode & ~OSMODE_DISABLE_BIT : osmode | OSMODE_DISABLE_BIT;
}

/** SNAPMODE / GRIDMODE / ORTHOMODE / PSLTSCALE — encode 0/1 sysvars as bool. */
export function modeFlagFromInt(value: number): boolean {
  return value !== 0;
}

export function setModeFlagOnInt(enabled: boolean): number {
  return enabled ? 1 : 0;
}

/** AUTOSNAP / POLARMODE — single-bit toggles inside an int bitfield. */
export function bitFromInt(value: number, bit: number): boolean {
  return (value & bit) !== 0;
}

export function setBitOnInt(value: number, bit: number, enabled: boolean): number {
  return enabled ? value | bit : value & ~bit;
}

// AUTOSNAP bit values per AutoCAD 2026 docs:
//   1=marker, 2=magnet, 4=tooltip, 8=aperture, 16=polar-track, 32=otrack.
export const AUTOSNAP_POLAR_TRACK_BIT = 16;
export const AUTOSNAP_OTRACK_BIT = 32;
