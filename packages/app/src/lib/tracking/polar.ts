import type { Vec2 } from '../shell/types';

export interface PolarResult {
  point: Vec2;
  angle: number;
}

export function snapToPolarAngle(from: Vec2, cursor: Vec2, incrementDeg: number): PolarResult {
  const dx = cursor.x - from.x;
  const dy = cursor.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const rawAngle = Math.atan2(dy, dx);
  const rawDeg = ((rawAngle * 180) / Math.PI + 360) % 360;
  const incr = Math.max(1, incrementDeg);
  const snappedDeg = Math.round(rawDeg / incr) * incr;
  const snappedRad = (snappedDeg * Math.PI) / 180;
  return {
    point: {
      x: from.x + dist * Math.cos(snappedRad),
      y: from.y + dist * Math.sin(snappedRad),
    },
    angle: snappedDeg,
  };
}

export function isPolarClose(
  from: Vec2,
  cursor: Vec2,
  incrementDeg: number,
  thresholdDeg: number = 5,
): boolean {
  const dx = cursor.x - from.x;
  const dy = cursor.y - from.y;
  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) return false;
  const rawDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const incr = Math.max(1, incrementDeg);
  const nearest = Math.round(rawDeg / incr) * incr;
  const diff = Math.abs(rawDeg - nearest);
  return diff <= thresholdDeg || diff >= 360 - thresholdDeg;
}
