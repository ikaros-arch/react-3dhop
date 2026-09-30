import { describe, expect, it } from 'vitest';
import {
  AXIS_COLORS,
  buildAxes,
  buildBoxGrid,
  buildFixedGrid,
  buildFlatGrid,
  coarsenStep,
  gridStepForUnit
} from '../src/geometry/grid.js';
import type { SceneBounds } from '../src/viewer/types.js';

const bounds: SceneBounds = {
  min: [-2, 0, -2],
  max: [2, 3, 2],
  center: [0, 1.5, 0],
  size: [4, 3, 4],
  radius: 3,
  source: 'vertices'
};

describe('gridStepForUnit', () => {
  it('follows BITFROST: 1 cm cells expressed in the model unit', () => {
    expect(gridStepForUnit('mm')).toBe(10);
    expect(gridStepForUnit('cm')).toBe(1);
    expect(gridStepForUnit('m')).toBe(0.01);
    expect(gridStepForUnit(' MM ')).toBe(10);
    expect(gridStepForUnit(undefined)).toBe(1);
    expect(gridStepForUnit('furlongs')).toBe(1);
  });
});

describe('coarsenStep', () => {
  it('doubles the step until the line budget is met', () => {
    expect(coarsenStep(1, 100)).toBe(1);
    expect(coarsenStep(1, 1000)).toBe(8); // 1000/8 = 125 ≤ 200
    expect(coarsenStep(1, 100, 10)).toBe(16);
  });

  it('leaves degenerate inputs alone', () => {
    expect(coarsenStep(0, 10)).toBe(0);
    expect(coarsenStep(1, 0)).toBe(1);
  });
});

describe('buildFlatGrid', () => {
  it('lies on the floor plane (y = min) and spans the radius around the centre', () => {
    const grid = buildFlatGrid(bounds, 1);
    expect(grid.type).toBe('lines');
    const n = Math.floor(bounds.radius / 1); // 3 → g from -3..3 → 7 lines each way
    expect(grid.vertices).toHaveLength(7 * 4);
    expect(grid.vertices.every((v) => v[1] === bounds.min[1])).toBe(true);
    const xs = grid.vertices.map((v) => v[0]);
    expect(Math.min(...xs)).toBe(-n);
    expect(Math.max(...xs)).toBe(n);
  });

  it('coarsens the step for very large scenes', () => {
    const huge: SceneBounds = { ...bounds, radius: 10_000, size: [20_000, 20_000, 20_000] };
    const grid = buildFlatGrid(huge, 1);
    // ≤ (2·200+1)·4 vertices even though radius/step would give 20 001 lines.
    expect(grid.vertices.length).toBeLessThanOrEqual((2 * 200 + 1) * 4);
  });
});

describe('buildBoxGrid', () => {
  it('snaps the box outward to whole steps and is translucent', () => {
    const grid = buildBoxGrid(bounds, 1);
    expect(grid.useTransparency).toBe(true);
    // steps = [4, 3, 4]: box exactly equals bounds here.
    const xs = grid.vertices.map((v) => v[0]);
    const ys = grid.vertices.map((v) => v[1]);
    expect(Math.min(...xs)).toBeCloseTo(-2);
    expect(Math.max(...xs)).toBeCloseTo(2);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(3);
  });

  it('grows to enclose bounds that are not a whole number of steps', () => {
    const odd: SceneBounds = { ...bounds, size: [2.5, 3, 4] };
    const grid = buildBoxGrid(odd, 1);
    const xs = grid.vertices.map((v) => v[0]);
    // ceil(2.5) = 3 steps, centred on 0 → ±1.5
    expect(Math.min(...xs)).toBeCloseTo(-1.5);
    expect(Math.max(...xs)).toBeCloseTo(1.5);
  });

  it('emits an even vertex count (line pairs)', () => {
    expect(buildBoxGrid(bounds, 1).vertices.length % 2).toBe(0);
  });
});

describe('buildFixedGrid', () => {
  it('lies on the world XY plane at the origin regardless of the scene centre', () => {
    const offset: SceneBounds = { ...bounds, center: [100, 100, 100], min: [98, 98, 98], max: [102, 102, 102] };
    const grid = buildFixedGrid(offset, 1);
    expect(grid.vertices.every((v) => v[2] === 0)).toBe(true);
    const xs = grid.vertices.map((v) => v[0]);
    expect(Math.min(...xs)).toBe(-3);
    expect(Math.max(...xs)).toBe(3);
    expect(grid.zOff).toBe(0.5);
    expect(grid.useTransparency).toBe(true);
  });
});

describe('buildAxes', () => {
  it('draws RGB axes of half the radius from the bounds centre by default', () => {
    const axes = buildAxes(bounds);
    expect(axes.x.vertices).toEqual([[0, 1.5, 0], [1.5, 1.5, 0]]);
    expect(axes.y.vertices).toEqual([[0, 1.5, 0], [0, 3, 0]]);
    expect(axes.z.vertices).toEqual([[0, 1.5, 0], [0, 1.5, 1.5]]);
    expect(axes.x.color).toEqual(AXIS_COLORS.x);
    expect(axes.y.color).toEqual(AXIS_COLORS.y);
    expect(axes.z.color).toEqual(AXIS_COLORS.z);
  });

  it('accepts an explicit origin', () => {
    const axes = buildAxes(bounds, [0, 0, 0]);
    expect(axes.x.vertices[0]).toEqual([0, 0, 0]);
    expect(axes.x.vertices[1]).toEqual([1.5, 0, 0]);
  });
});
