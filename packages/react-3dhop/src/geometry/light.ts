import type { Vector3 } from '../viewer/types.js';

/** A point in the light-controller disc: `x`, `y` in [-0.5, 0.5], `y` pointing down (screen). */
export type DiscPoint = [number, number];

/**
 * Maps 3DHOP's `_lightDirection` (unit vector towards the light, set by `rotateLight(x, y)` as
 * `[-2x, -2y, -z]`) back to the disc point the controller should draw. Screen `y` points down,
 * and BITFROST calls `rotateLight(px, -py)`, hence the sign asymmetry.
 */
export function lightDirectionToDisc(direction: readonly number[] | null | undefined): DiscPoint {
  if (!direction || direction.length < 2) return [0, 0];
  // `|| 0` folds -0 into 0 so callers can compare values naively.
  return [-direction[0] / 2 || 0, direction[1] / 2 || 0];
}

/** The `rotateLight(x, y)` arguments for a disc point. */
export function discToRotateLightArgs(point: DiscPoint): [number, number] {
  return [point[0] || 0, -point[1] || 0];
}

/**
 * Converts a pointer position in canvas pixels to a disc point, or `null` when the pointer is
 * outside the active disc (the outer `deadZone` pixels are excluded like BITFROST does).
 */
export function pixelToDisc(
  px: number,
  py: number,
  size: number,
  radius: number,
  deadZone = 5
): DiscPoint | null {
  const mid = size / 2;
  const dx = px - mid;
  const dy = py - mid;
  const limit = radius - deadZone;
  if (dx * dx + dy * dy >= limit * limit) return null;
  return [dx / radius / 2, dy / radius / 2];
}

/** Canvas pixel position of a disc point (the highlight centre). */
export function discToPixel(point: DiscPoint, size: number, radius: number): [number, number] {
  const mid = size / 2;
  return [mid + point[0] * radius * 2, mid + point[1] * radius * 2];
}

/** The unit vector 3DHOP would store for a disc point (for tests and previews). */
export function discToLightDirection(point: DiscPoint): Vector3 {
  let x = point[0] * 2;
  let y = -point[1] * 2;
  let r = Math.hypot(x, y);
  if (r >= 1) {
    x /= r;
    y /= r;
    r = 0.999;
  }
  const z = Math.sqrt(1 - r * r);
  return [-x, -y, -z];
}
