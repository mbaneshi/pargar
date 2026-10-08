export function parseCoordinate(
  input: string,
  lastPoint: { x: number; y: number },
): { x: number; y: number } | null {
  const trimmed = input.trim();

  // Polar: @distance<angle
  const polar = trimmed.match(/^@([\d.]+)<([\d.]+)$/);
  if (polar) {
    const dist = parseFloat(polar[1]);
    const angle = (parseFloat(polar[2]) * Math.PI) / 180;
    return {
      x: lastPoint.x + dist * Math.cos(angle),
      y: lastPoint.y + dist * Math.sin(angle),
    };
  }

  // Relative: @dx,dy
  const rel = trimmed.match(/^@([-\d.]+),([-\d.]+)$/);
  if (rel) {
    return {
      x: lastPoint.x + parseFloat(rel[1]),
      y: lastPoint.y + parseFloat(rel[2]),
    };
  }

  // Absolute: x,y
  const abs = trimmed.match(/^([-\d.]+),([-\d.]+)$/);
  if (abs) {
    return { x: parseFloat(abs[1]), y: parseFloat(abs[2]) };
  }

  return null;
}
