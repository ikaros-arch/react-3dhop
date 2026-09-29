import type { Vector3 } from '../viewer/types.js';

/**
 * Minimal column-major 4x4 helpers matching SpiderGL's `SglMat4` layout, so scene transforms can
 * be applied without reaching for 3DHOP's globals.
 */
export type Mat4 = number[];

export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function isMat4(value: unknown): value is Mat4 {
  return Array.isArray(value) && value.length === 16 && value.every((n) => typeof n === 'number');
}

/** `a * b`, column-major. */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** Applies `m` to a point (w = 1), returning the dehomogenised result. */
export function transformPoint(m: Mat4, p: Vector3): Vector3 {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return w !== 0 && w !== 1 ? [x / w, y / w, z / w] : [x, y, z];
}

/**
 * Largest scale factor a matrix applies along any axis. Used to scale radii when a transform is
 * not uniform.
 */
export function maxScale(m: Mat4): number {
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  return Math.max(sx, sy, sz);
}
