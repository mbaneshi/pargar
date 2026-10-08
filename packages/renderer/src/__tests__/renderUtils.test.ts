import { describe, it, expect } from 'vitest';
import { nextPow2, clipLineToBBox, pointToSegmentDist } from '../renderUtils';

describe('nextPow2', () => {
  it('returns 1 for 1', () => expect(nextPow2(1)).toBe(1));
  it('returns 2 for 2', () => expect(nextPow2(2)).toBe(2));
  it('returns 4 for 3', () => expect(nextPow2(3)).toBe(4));
  it('returns 256 for 255', () => expect(nextPow2(255)).toBe(256));
  it('returns 256 for 256', () => expect(nextPow2(256)).toBe(256));
  it('returns 512 for 257', () => expect(nextPow2(257)).toBe(512));
  it('handles fractional', () => expect(nextPow2(1.5)).toBe(2));
});

describe('clipLineToBBox', () => {
  const b = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

  it('line fully inside', () => {
    expect(clipLineToBBox(2, 2, 8, 8, b.minX, b.minY, b.maxX, b.maxY)).toEqual([2, 2, 8, 8]);
  });

  it('line fully outside', () => {
    expect(clipLineToBBox(20, 20, 30, 30, b.minX, b.minY, b.maxX, b.maxY)).toBeNull();
  });

  it('clips one edge', () => {
    const r = clipLineToBBox(-5, 5, 5, 5, b.minX, b.minY, b.maxX, b.maxY)!;
    expect(r[0]).toBeCloseTo(0);
    expect(r[2]).toBeCloseTo(5);
  });

  it('clips two edges', () => {
    const r = clipLineToBBox(-5, 5, 15, 5, b.minX, b.minY, b.maxX, b.maxY)!;
    expect(r[0]).toBeCloseTo(0);
    expect(r[2]).toBeCloseTo(10);
  });

  it('clips diagonal', () => {
    const r = clipLineToBBox(-5, -5, 15, 15, b.minX, b.minY, b.maxX, b.maxY)!;
    expect(r[0]).toBeCloseTo(0);
    expect(r[1]).toBeCloseTo(0);
    expect(r[2]).toBeCloseTo(10);
    expect(r[3]).toBeCloseTo(10);
  });

  it('line above bbox', () => {
    expect(clipLineToBBox(0, 15, 10, 15, b.minX, b.minY, b.maxX, b.maxY)).toBeNull();
  });
});

describe('pointToSegmentDist', () => {
  it('point on segment', () => expect(pointToSegmentDist(5, 0, 0, 0, 10, 0)).toBeCloseTo(0));
  it('perpendicular distance', () => expect(pointToSegmentDist(5, 3, 0, 0, 10, 0)).toBeCloseTo(3));
  it('beyond start', () => expect(pointToSegmentDist(-3, 0, 0, 0, 10, 0)).toBeCloseTo(3));
  it('beyond end', () => expect(pointToSegmentDist(13, 0, 0, 0, 10, 0)).toBeCloseTo(3));
  it('zero-length segment', () => expect(pointToSegmentDist(3, 4, 0, 0, 0, 0)).toBeCloseTo(5));
});
