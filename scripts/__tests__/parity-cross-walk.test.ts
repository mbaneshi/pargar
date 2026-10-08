import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  crossWalkCommand,
  crossWalkSysvar,
  parseKernelCommandVariants,
  parseKernelCommandVariantsWithLines,
  parseKernelSysvars,
  parseKernelSysvarsWithLines,
} from '../parity/cross-walk';

const here = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(resolve(here, 'fixtures', name), 'utf-8');
}

describe('parseKernelCommandVariants', () => {
  it('extracts every Command enum variant name in source order, including unit variants', () => {
    const src = loadFixture('sample-commands.rs');

    const result = parseKernelCommandVariants(src);

    expect(result).toEqual([
      'CreatePoint',
      'CreateLine',
      'DeleteEntity',
      'MoveEntity',
      'Undo',
      'Redo',
      'AnalyzeDof',
    ]);
  });

  it('returns [] when no Command enum is found', () => {
    expect(parseKernelCommandVariants('// no enum here\nfn foo() {}\n')).toEqual([]);
  });

  it('survives indentation drift (tabs or 2-space) — #68 hardening', () => {
    const twoSpace = 'pub enum Command {\n  CreatePoint,\n  CreateLine,\n}\n';
    const tabbed = 'pub enum Command {\n\tCreatePoint,\n\tCreateLine,\n}\n';
    expect(parseKernelCommandVariants(twoSpace)).toEqual([
      'CreatePoint',
      'CreateLine',
    ]);
    expect(parseKernelCommandVariants(tabbed)).toEqual([
      'CreatePoint',
      'CreateLine',
    ]);
  });
});

describe('parseKernelSysvars', () => {
  it('extracts every sysvar name from m.insert("NAME", ...) calls in source order', () => {
    const src = loadFixture('sample-lib.rs');

    const result = parseKernelSysvars(src);

    expect(result).toEqual(['OFFSETDIST', 'FILLETRAD', 'TRIMMODE', 'CHAMFERA']);
  });
});

describe('parseKernelSysvarsWithLines', () => {
  it('returns each sysvar with its absolute line number — backs per-sysvar source (#69)', () => {
    const src = loadFixture('sample-lib.rs');

    const result = parseKernelSysvarsWithLines(src);

    expect(result.map((v) => v.name)).toEqual([
      'OFFSETDIST',
      'FILLETRAD',
      'TRIMMODE',
      'CHAMFERA',
    ]);
    // sample-lib.rs has the first m.insert at line 5
    expect(result[0]).toEqual({ name: 'OFFSETDIST', line: 5 });
    expect(result.find((v) => v.name === 'CHAMFERA')?.line).toBe(8);
  });
});

describe('parseKernelCommandVariantsWithLines', () => {
  it('returns each variant with its absolute line number in the source file', () => {
    const src = loadFixture('sample-commands.rs');

    const result = parseKernelCommandVariantsWithLines(src);

    expect(result.map((v) => v.name)).toEqual([
      'CreatePoint',
      'CreateLine',
      'DeleteEntity',
      'MoveEntity',
      'Undo',
      'Redo',
      'AnalyzeDof',
    ]);
    // sample-commands.rs has CreatePoint at line 7
    expect(result[0]).toEqual({ name: 'CreatePoint', line: 7 });
    expect(result.find((v) => v.name === 'Undo')?.line).toBeGreaterThan(20);
  });
});

describe('crossWalkCommand', () => {
  const variantLines = new Map<string, number>([
    ['CreateLine', 30],
    ['CreateCircle', 37],
    ['CreateCircle2P', 608],
  ]);

  it("returns 'yes' for a mapped command with variants present in the kernel, and notes which mapped variants are missing", () => {
    const result = crossWalkCommand('CIRCLE', variantLines);

    expect(result.nexus_implemented).toBe('yes');
    expect(result.nexus_source).toContain('packages/kernel/src/commands.rs:37');
    expect(result.nexus_source).toContain('packages/kernel/src/commands.rs:608');
    expect(result.notes).toContain('CreateCircle3P');
    expect(result.notes).toContain('CreateCircleTtr');
  });

  it("returns 'yes' with empty notes when every mapped variant is present", () => {
    const result = crossWalkCommand('LINE', variantLines);

    expect(result.nexus_implemented).toBe('yes');
    expect(result.nexus_source).toBe('packages/kernel/src/commands.rs:30');
    expect(result.notes).toBe('');
  });

  it("returns 'parked' for SD-05 out-of-scope commands (3D / mesh / surface)", () => {
    expect(crossWalkCommand('3DARRAY', variantLines).nexus_implemented).toBe(
      'parked',
    );
    expect(crossWalkCommand('EXTRUDE', variantLines).nexus_implemented).toBe(
      'parked',
    );
    expect(crossWalkCommand('MESHCAP', variantLines).nexus_implemented).toBe(
      'parked',
    );
  });

  it("returns 'no' for an unmapped, in-scope command", () => {
    const result = crossWalkCommand('SOMEUNMAPPEDTHING', variantLines);
    expect(result.nexus_implemented).toBe('no');
    expect(result.nexus_source).toBe('');
  });
});

describe('crossWalkSysvar', () => {
  it("returns 'yes' with the sysvar's own source line in sysvars.rs (#68 file + #69 per-line)", () => {
    const sysvarLines = new Map<string, number>([
      ['OFFSETDIST', 42],
      ['FILLETRAD', 45],
    ]);
    const r = crossWalkSysvar('OFFSETDIST', sysvarLines);
    expect(r.nexus_implemented).toBe('yes');
    expect(r.nexus_source).toBe('packages/kernel/src/sysvars.rs:42');
  });

  it('points each mapped sysvar at its own line, not a shared block header (#69)', () => {
    const sysvarLines = new Map<string, number>([
      ['OFFSETDIST', 42],
      ['FILLETRAD', 45],
    ]);
    expect(crossWalkSysvar('FILLETRAD', sysvarLines).nexus_source).toBe(
      'packages/kernel/src/sysvars.rs:45',
    );
  });

  it("returns 'no' for AutoCAD sysvars not present in the kernel", () => {
    expect(
      crossWalkSysvar('OSMODE', new Map<string, number>()).nexus_implemented,
    ).toBe('no');
  });
});
