import type { SceneBounds, SceneEntitySpec, Vector3 } from '../viewer/types.js';

export type GridMode = 'off' | 'flat' | 'box' | 'fixed' | 'axes';

export const GRID_MODES: readonly GridMode[] = ['off', 'flat', 'box', 'fixed', 'axes'];

export const GRID_FLAT_COLOR: [number, number, number, number] = [0.8, 0.8, 0.8, 0.8];
export const GRID_BOX_COLOR: [number, number, number, number] = [0.8, 0.8, 0.8, 0.5];
export const GRID_FIXED_COLOR: [number, number, number, number] = [0.7, 0.7, 0.7, 0.5];
export const AXIS_COLORS: Record<'x' | 'y' | 'z', [number, number, number, number]> = {
  x: [1, 0.2, 0.2, 1],
  y: [0.2, 1, 0.2, 1],
  z: [0.2, 0.2, 1, 1]
};

/** Upper bound on grid lines per axis before the step is coarsened (keeps huge models usable). */
export const MAX_GRID_LINES_PER_AXIS = 200;

/**
 * The grid step for a display unit, following BITFROST: models are assumed to be in cm-scale
 * units, so a 1 cm cell is 10 model units when the unit is `mm`, 1 when `cm`, and 0.01 when `m`.
 * Unknown units fall back to 1.
 */
export function gridStepForUnit(unit: string | undefined): number {
  switch ((unit ?? '').trim().toLowerCase()) {
    case 'mm':
      return 10;
    case 'm':
      return 0.01;
    case 'cm':
    default:
      return 1;
  }
}

/**
 * Doubles `step` until no more than `maxLines` lines are needed to span `extent`. Returns the
 * (possibly unchanged) step; never shrinks it.
 */
export function coarsenStep(step: number, extent: number, maxLines = MAX_GRID_LINES_PER_AXIS): number {
  if (!(step > 0) || !(extent > 0)) return step;
  let s = step;
  while (extent / s > maxLines) s *= 2;
  return s;
}

/**
 * A square grid on the horizontal (y = min) plane under the model, centred on the bounds and
 * reaching `radius` in each direction — BITFROST's "base grid".
 */
export function buildFlatGrid(bounds: SceneBounds, step: number): SceneEntitySpec {
  const s = coarsenStep(step, 2 * bounds.radius);
  const n = Math.max(1, Math.floor(bounds.radius / s));
  const [xc, , zc] = bounds.center;
  const y = bounds.min[1];
  const vertices: Vector3[] = [];
  for (let g = -n; g <= n; g++) {
    vertices.push([xc + g * s, y, zc - s * n], [xc + g * s, y, zc + s * n]);
    vertices.push([xc - s * n, y, zc + g * s], [xc + s * n, y, zc + g * s]);
  }
  return { type: 'lines', vertices, color: [...GRID_FLAT_COLOR], zOff: 0 };
}

/**
 * A grid drawn on all six faces of the axis-aligned box that encloses the bounds, snapped
 * outward to whole steps — BITFROST's "box grid".
 */
export function buildBoxGrid(bounds: SceneBounds, step: number): SceneEntitySpec {
  const s = coarsenStep(step, Math.max(...bounds.size));
  const steps = bounds.size.map((extent) => Math.max(1, Math.ceil(extent / s))) as Vector3;
  const lo = bounds.center.map((c, i) => c - (steps[i] / 2) * s) as Vector3;
  const hi = bounds.center.map((c, i) => c + (steps[i] / 2) * s) as Vector3;
  const vertices: Vector3[] = [];

  // Lines parallel to X, on the four Y/Z edges-planes.
  for (let i = 0; i <= steps[1]; i++) {
    const y = lo[1] + s * i;
    vertices.push([lo[0], y, lo[2]], [hi[0], y, lo[2]], [lo[0], y, hi[2]], [hi[0], y, hi[2]]);
  }
  for (let i = 0; i <= steps[2]; i++) {
    const z = lo[2] + s * i;
    vertices.push([lo[0], lo[1], z], [hi[0], lo[1], z], [lo[0], hi[1], z], [hi[0], hi[1], z]);
  }
  // Lines parallel to Y.
  for (let i = 0; i <= steps[0]; i++) {
    const x = lo[0] + s * i;
    vertices.push([x, lo[1], lo[2]], [x, hi[1], lo[2]], [x, lo[1], hi[2]], [x, hi[1], hi[2]]);
  }
  for (let i = 0; i <= steps[2]; i++) {
    const z = lo[2] + s * i;
    vertices.push([lo[0], lo[1], z], [lo[0], hi[1], z], [hi[0], lo[1], z], [hi[0], hi[1], z]);
  }
  // Lines parallel to Z.
  for (let i = 0; i <= steps[0]; i++) {
    const x = lo[0] + s * i;
    vertices.push([x, lo[1], lo[2]], [x, lo[1], hi[2]], [x, hi[1], lo[2]], [x, hi[1], hi[2]]);
  }
  for (let i = 0; i <= steps[1]; i++) {
    const y = lo[1] + s * i;
    vertices.push([lo[0], y, lo[2]], [lo[0], y, hi[2]], [hi[0], y, lo[2]], [hi[0], y, hi[2]]);
  }

  return { type: 'lines', vertices, color: [...GRID_BOX_COLOR], zOff: 0, useTransparency: true };
}

/**
 * A square grid on the world XY plane (z = 0) centred on the world origin, sized to the scene
 * radius — BITFROST's "fixed" grid, useful for models that are registered to a site datum.
 */
export function buildFixedGrid(bounds: SceneBounds, step: number): SceneEntitySpec {
  const s = coarsenStep(step, 2 * bounds.radius);
  const n = Math.max(1, Math.floor(bounds.radius / s));
  const vertices: Vector3[] = [];
  for (let g = -n; g <= n; g++) {
    vertices.push([g * s, -s * n, 0], [g * s, s * n, 0]);
    vertices.push([-s * n, g * s, 0], [s * n, g * s, 0]);
  }
  return { type: 'lines', vertices, color: [...GRID_FIXED_COLOR], zOff: 0.5, useTransparency: true };
}

export type AxesSpecs = { x: SceneEntitySpec; y: SceneEntitySpec; z: SceneEntitySpec };

/**
 * Three axis lines of length `radius / 2` from `origin` (default: the bounds centre; pass
 * `[0,0,0]` for the world origin), coloured R/G/B for X/Y/Z.
 */
export function buildAxes(bounds: SceneBounds, origin: Vector3 = bounds.center): AxesSpecs {
  const len = bounds.radius / 2;
  const line = (dir: Vector3, color: [number, number, number, number]): SceneEntitySpec => ({
    type: 'lines',
    vertices: [
      [...origin],
      [origin[0] + dir[0] * len, origin[1] + dir[1] * len, origin[2] + dir[2] * len]
    ],
    color: [...color],
    zOff: 0
  });
  return {
    x: line([1, 0, 0], AXIS_COLORS.x),
    y: line([0, 1, 0], AXIS_COLORS.y),
    z: line([0, 0, 1], AXIS_COLORS.z)
  };
}
