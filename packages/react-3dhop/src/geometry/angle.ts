import type { SceneEntitySpec, Vector3 } from '../viewer/types.js';

/** Colour of the picked points and the two arms, matching 3DHOP's own measurement guides. */
export const ANGLE_LINE_COLOR: [number, number, number, number] = [0.2, 0.3, 0.9, 1];
/** Colour of the translucent wedge that fills the angle. */
export const ANGLE_WEDGE_COLOR: [number, number, number, number] = [0.2, 0.5, 0.7, 0.3];

export type AngleStage = 0 | 1 | 2 | 3;

export type AngleEntities = {
  points: SceneEntitySpec | null;
  lines: SceneEntitySpec | null;
  wedge: SceneEntitySpec | null;
};

function sub(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function length(v: Vector3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function dot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function scaleAdd(origin: Vector3, direction: Vector3, factor: number): Vector3 {
  return [origin[0] + direction[0] * factor, origin[1] + direction[1] * factor, origin[2] + direction[2] * factor];
}

/**
 * The angle, in degrees, at vertex `b` of the triangle a–b–c (i.e. between the arms b→a and b→c).
 * Returns `NaN` when either arm has zero length.
 */
export function computeAngle(a: Vector3, b: Vector3, c: Vector3): number {
  const ba = sub(a, b);
  const bc = sub(c, b);
  const lenA = length(ba);
  const lenC = length(bc);
  if (lenA === 0 || lenC === 0) return NaN;
  const cosine = Math.min(1, Math.max(-1, dot(ba, bc) / (lenA * lenC)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function formatAngle(degrees: number | null, digits = 2): string {
  if (degrees == null || Number.isNaN(degrees)) return '—';
  return `${degrees.toFixed(digits)}°`;
}

/**
 * Builds the helper entities for an in-progress or finished angle measurement.
 *
 * - `points`: every picked point so far (as a `points` entity).
 * - `lines`: the arms from the vertex (second pick) to the first and third picks.
 * - `wedge`: a translucent triangle inside the angle whose arms are 75% of the shorter arm, so
 *   the fill stays inside the measured corner.
 *
 * Entities not yet meaningful for the number of points are `null` so callers can remove them.
 */
export function angleEntities(points: readonly Vector3[]): AngleEntities {
  const stage = Math.min(points.length, 3) as AngleStage;
  const result: AngleEntities = { points: null, lines: null, wedge: null };

  if (stage === 0) return result;

  result.points = {
    type: 'points',
    vertices: points.slice(0, stage).map((p) => [...p] as Vector3),
    color: [...ANGLE_LINE_COLOR],
    pointSize: 6,
    zOff: 0.001
  };

  if (stage < 2) return result;

  const [a, b] = points;
  const lineVertices: Vector3[] = [[...b], [...a]];
  if (stage === 3) {
    const c = points[2];
    lineVertices.push([...b], [...c]);
  }
  result.lines = {
    type: 'lines',
    vertices: lineVertices,
    color: [...ANGLE_LINE_COLOR],
    zOff: 0.001
  };

  if (stage < 3) return result;

  const c = points[2];
  const ba = sub(a, b);
  const bc = sub(c, b);
  const lenA = length(ba);
  const lenC = length(bc);
  if (lenA === 0 || lenC === 0) return result;

  const reach = 0.75 * Math.min(lenA, lenC);
  const armA = scaleAdd(b, ba, reach / lenA);
  const armC = scaleAdd(b, bc, reach / lenC);
  result.wedge = {
    type: 'triangles',
    vertices: [[...b], armA, armC],
    color: [...ANGLE_WEDGE_COLOR],
    useTransparency: true,
    zOff: 0.01
  };

  return result;
}
