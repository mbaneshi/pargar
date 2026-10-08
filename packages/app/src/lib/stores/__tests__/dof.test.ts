import { describe, it, expect } from 'vitest';

interface DofInfo {
  total: number;
  constrained: number;
  free: number;
}

function computeDofDisplay(
  dofResults: Map<string, DofInfo>,
  remaining: number,
  isOver: boolean,
  hasConstraints: boolean,
) {
  const show = hasConstraints;
  let label = `DOF: ${remaining}`;
  let color: 'blue' | 'green' | 'red' = 'blue';

  if (remaining === 0 && !isOver) {
    label = 'DOF: 0 \u2713';
    color = 'green';
  } else if (isOver) {
    label = `DOF: ${remaining} !`;
    color = 'red';
  }

  return { show, label, color };
}

function computeEntityOverlay(
  dofResults: Map<string, DofInfo>,
  showDofColors: boolean,
): Map<string, string> | null {
  if (!showDofColors || dofResults.size === 0) return null;
  const overlay = new Map<string, string>();
  for (const [id, info] of dofResults) {
    if (info.free > 0) overlay.set(id, '#4488ff');
    else if (info.free === 0) overlay.set(id, '#44cc44');
    else overlay.set(id, '#ff4444');
  }
  return overlay;
}

describe('DOF display logic', () => {
  it('shows nothing when no constraints exist', () => {
    const result = computeDofDisplay(new Map(), 0, false, false);
    expect(result.show).toBe(false);
  });

  it('shows green checkmark when fully constrained', () => {
    const dof = new Map([['e1', { total: 4, constrained: 4, free: 0 }]]);
    const result = computeDofDisplay(dof, 0, false, true);
    expect(result.show).toBe(true);
    expect(result.label).toBe('DOF: 0 \u2713');
    expect(result.color).toBe('green');
  });

  it('shows blue with count when under-constrained', () => {
    const dof = new Map([['e1', { total: 4, constrained: 2, free: 2 }]]);
    const result = computeDofDisplay(dof, 2, false, true);
    expect(result.show).toBe(true);
    expect(result.label).toBe('DOF: 2');
    expect(result.color).toBe('blue');
  });

  it('shows red with bang when over-constrained', () => {
    const dof = new Map([['e1', { total: 4, constrained: 6, free: -2 }]]);
    const result = computeDofDisplay(dof, -2, true, true);
    expect(result.show).toBe(true);
    expect(result.label).toBe('DOF: -2 !');
    expect(result.color).toBe('red');
  });
});

describe('DOF entity overlay', () => {
  it('returns null when showDofColors is false', () => {
    const dof = new Map([['e1', { total: 4, constrained: 2, free: 2 }]]);
    expect(computeEntityOverlay(dof, false)).toBeNull();
  });

  it('returns null when dofResults is empty', () => {
    expect(computeEntityOverlay(new Map(), true)).toBeNull();
  });

  it('maps entity colors correctly', () => {
    const dof = new Map<string, DofInfo>([
      ['e1', { total: 4, constrained: 4, free: 0 }],
      ['e2', { total: 4, constrained: 2, free: 2 }],
      ['e3', { total: 4, constrained: 6, free: -2 }],
    ]);
    const overlay = computeEntityOverlay(dof, true)!;
    expect(overlay.get('e1')).toBe('#44cc44');
    expect(overlay.get('e2')).toBe('#4488ff');
    expect(overlay.get('e3')).toBe('#ff4444');
  });
});
