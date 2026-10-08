import { describe, it, expect } from 'vitest';
import { findOtrackSnap } from './otrack';

describe('findOtrackSnap', () => {
  it('returns null with no acquired points', () => {
    expect(findOtrackSnap({ x: 5, y: 5 }, [], 2)).toBeNull();
  });

  it('snaps horizontally to an acquired point', () => {
    const result = findOtrackSnap({ x: 10, y: 5.5 }, [{ x: 3, y: 5 }], 1);
    expect(result).not.toBeNull();
    expect(result!.point.x).toBe(10);
    expect(result!.point.y).toBe(5);
    expect(result!.guides).toHaveLength(1);
    expect(result!.guides[0].horizontal).toBe(true);
  });

  it('snaps vertically to an acquired point', () => {
    const result = findOtrackSnap({ x: 5.5, y: 10 }, [{ x: 5, y: 3 }], 1);
    expect(result).not.toBeNull();
    expect(result!.point.x).toBe(5);
    expect(result!.point.y).toBe(10);
    expect(result!.guides).toHaveLength(1);
    expect(result!.guides[0].horizontal).toBe(false);
  });

  it('snaps to intersection of two acquired points', () => {
    const result = findOtrackSnap(
      { x: 9.8, y: 5.2 },
      [
        { x: 3, y: 5 },
        { x: 10, y: 8 },
      ],
      1,
    );
    expect(result).not.toBeNull();
    expect(result!.point.x).toBe(10);
    expect(result!.point.y).toBe(5);
    expect(result!.guides).toHaveLength(2);
  });

  it('returns null when cursor is far from alignment lines', () => {
    const result = findOtrackSnap({ x: 10, y: 10 }, [{ x: 3, y: 5 }], 1);
    expect(result).toBeNull();
  });

  it('limits to closest single guide when no intersection', () => {
    const result = findOtrackSnap({ x: 10, y: 5.3 }, [{ x: 3, y: 5 }], 0.5);
    expect(result).not.toBeNull();
    expect(result!.point.y).toBe(5);
  });
});
