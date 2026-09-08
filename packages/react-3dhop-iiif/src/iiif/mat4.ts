import type { Vector3 } from './types.js';

/**
 * A minimal 4x4 matrix implementation matching SpiderGL's conventions, so the matrices produced
 * here can be handed straight to 3DHOP.
 *
 * Layout is **column-major**: `m[column * 4 + row]`, the same order WebGL expects. A translation
 * therefore lives in elements 12, 13 and 14. `multiply(a, b)` returns `a · b`, so the rightmost
 * factor is applied to a point first.
 *
 * This is reimplemented rather than delegated to the `SglMat4` global so it can be unit-tested in
 * Node and does not depend on 3DHOP's scripts having loaded.
 */
export type Mat4 = number[];

export function identity(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function translation([x, y, z]: Vector3): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

export function scaling([x, y, z]: Vector3): Mat4 {
  return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Rotation of `angle` radians about `axis`, via Rodrigues' formula. */
export function rotationAngleAxis(angle: number, axis: Vector3): Mat4 {
  const length = Math.hypot(axis[0], axis[1], axis[2]);
  if (length === 0) {
    return identity();
  }

  const x = axis[0] / length;
  const y = axis[1] / length;
  const z = axis[2] / length;

  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const t = 1 - c;

  return [
    t * x * x + c,
    t * x * y + z * s,
    t * z * x - y * s,
    0,
    t * x * y - z * s,
    t * y * y + c,
    t * y * z + x * s,
    0,
    t * z * x + y * s,
    t * y * z - x * s,
    t * z * z + c,
    0,
    0,
    0,
    0,
    1
  ];
}

/** Returns `a · b`. */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out: Mat4 = new Array(16);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row] * b[column * 4 + k];
      }
      out[column * 4 + row] = sum;
    }
  }

  return out;
}

/** Returns `a · b · c · …`, i.e. the rightmost matrix is applied to a point first. */
export function multiplyAll(...matrices: Mat4[]): Mat4 {
  return matrices.reduce<Mat4>((accumulator, matrix) => multiply(accumulator, matrix), identity());
}

/** Transforms a point (implicit w = 1) and performs the perspective divide. */
export function transformPoint(m: Mat4, [x, y, z]: Vector3): Vector3 {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const divisor = w === 0 ? 1 : w;

  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / divisor,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / divisor,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / divisor
  ];
}
