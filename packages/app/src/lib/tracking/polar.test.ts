import { describe, it, expect } from 'vitest';
import { snapToPolarAngle, isPolarClose } from './polar';

describe('snapToPolarAngle', () => {
  const origin = { x: 0, y: 0 };

  it('snaps to 0 degrees (east)', () => {
    const result = snapToPolarAngle(origin, { x: 10, y: 0.5 }, 15);
    expect(result.angle).toBe(0);
    expect(result.point.x).toBeCloseTo(10.012, 1);
    expect(result.point.y).toBeCloseTo(0, 5);
  });

  it('snaps to 90 degrees (north)', () => {
    const result = snapToPolarAngle(origin, { x: 0.3, y: 10 }, 15);
    expect(result.angle).toBe(90);
    expect(result.point.x).toBeCloseTo(0, 5);
    expect(result.point.y).toBeCloseTo(10.004, 1);
  });

  it('snaps to 45 degrees with 15-degree increment', () => {
    const result = snapToPolarAngle(origin, { x: 7, y: 7.2 }, 15);
    expect(result.angle).toBe(45);
    const dist = Math.sqrt(7 * 7 + 7.2 * 7.2);
    expect(result.point.x).toBeCloseTo(dist * Math.cos(Math.PI / 4), 5);
    expect(result.point.y).toBeCloseTo(dist * Math.sin(Math.PI / 4), 5);
  });

  it('snaps to 30 degrees with 30-degree increment', () => {
    const result = snapToPolarAngle(origin, { x: 8, y: 5 }, 30);
    expect(result.angle).toBe(30);
  });

  it('preserves distance from origin', () => {
    const cursor = { x: 8, y: 6 };
    const dist = Math.sqrt(cursor.x * cursor.x + cursor.y * cursor.y);
    const result = snapToPolarAngle(origin, cursor, 15);
    const resultDist = Math.sqrt(
      (result.point.x - origin.x) ** 2 + (result.point.y - origin.y) ** 2,
    );
    expect(resultDist).toBeCloseTo(dist, 10);
  });

  it('works with non-origin from point', () => {
    const from = { x: 5, y: 5 };
    const result = snapToPolarAngle(from, { x: 15, y: 5.2 }, 15);
    expect(result.angle).toBe(0);
    expect(result.point.y).toBeCloseTo(5, 5);
  });

  it('handles 180 degrees', () => {
    const result = snapToPolarAngle(origin, { x: -10, y: 0.1 }, 15);
    expect(result.angle).toBe(180);
  });

  it('handles 270 degrees (south)', () => {
    const result = snapToPolarAngle(origin, { x: 0.1, y: -10 }, 15);
    expect(result.angle).toBe(270);
  });
});

describe('isPolarClose', () => {
  const origin = { x: 0, y: 0 };

  it('returns true when cursor is near a polar angle', () => {
    expect(isPolarClose(origin, { x: 10, y: 0.3 }, 15, 5)).toBe(true);
  });

  it('returns false when cursor is far from any polar angle', () => {
    // ~22 degrees, midway between 15 and 30
    expect(isPolarClose(origin, { x: 10, y: 4 }, 15, 3)).toBe(false);
  });

  it('returns false for zero-length vector', () => {
    expect(isPolarClose(origin, { x: 0, y: 0 }, 15)).toBe(false);
  });

  it('returns true near 360/0 boundary', () => {
    expect(isPolarClose(origin, { x: 10, y: -0.3 }, 15, 5)).toBe(true);
  });
});
