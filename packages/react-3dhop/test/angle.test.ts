import { describe, expect, it } from 'vitest';
import { angleEntities, computeAngle, formatAngle } from '../src/geometry/angle.js';

describe('computeAngle', () => {
  it('measures a right angle at the middle point', () => {
    expect(computeAngle([1, 0, 0], [0, 0, 0], [0, 1, 0])).toBeCloseTo(90);
  });

  it('measures a straight line as 180°', () => {
    expect(computeAngle([-1, 0, 0], [0, 0, 0], [1, 0, 0])).toBeCloseTo(180);
  });

  it('is independent of arm length', () => {
    expect(computeAngle([10, 0, 0], [0, 0, 0], [3, 3, 0])).toBeCloseTo(45);
  });

  it('returns NaN for a zero-length arm', () => {
    expect(computeAngle([0, 0, 0], [0, 0, 0], [1, 0, 0])).toBeNaN();
  });

  it('clamps rounding drift so acos never sees |cos| > 1', () => {
    const p = [0.1, 0.2, 0.3] as const;
    expect(computeAngle([...p], [0, 0, 0], [...p])).toBe(0);
  });
});

describe('formatAngle', () => {
  it('formats with a degree sign and given precision', () => {
    expect(formatAngle(90.1234)).toBe('90.12°');
    expect(formatAngle(90.1234, 0)).toBe('90°');
  });

  it('shows a dash for missing values', () => {
    expect(formatAngle(null)).toBe('—');
    expect(formatAngle(NaN)).toBe('—');
  });
});

describe('angleEntities', () => {
  const a: [number, number, number] = [2, 0, 0];
  const b: [number, number, number] = [0, 0, 0];
  const c: [number, number, number] = [0, 4, 0];

  it('draws nothing with no points', () => {
    expect(angleEntities([])).toEqual({ points: null, lines: null, wedge: null });
  });

  it('draws only the point after the first pick', () => {
    const e = angleEntities([a]);
    expect(e.points?.vertices).toEqual([a]);
    expect(e.lines).toBeNull();
    expect(e.wedge).toBeNull();
  });

  it('draws one arm after the second pick', () => {
    const e = angleEntities([a, b]);
    expect(e.points?.vertices).toEqual([a, b]);
    expect(e.lines?.type).toBe('lines');
    expect(e.lines?.vertices).toEqual([b, a]);
    expect(e.wedge).toBeNull();
  });

  it('draws both arms and a wedge after the third pick', () => {
    const e = angleEntities([a, b, c]);
    expect(e.lines?.vertices).toEqual([b, a, b, c]);
    expect(e.wedge?.type).toBe('triangles');
    expect(e.wedge?.useTransparency).toBe(true);
    // Wedge arms are 75% of the shorter arm (|a-b| = 2 → 1.5) along each direction.
    expect(e.wedge?.vertices).toEqual([b, [1.5, 0, 0], [0, 1.5, 0]]);
  });

  it('skips the wedge when an arm is degenerate', () => {
    const e = angleEntities([b, b, c]);
    expect(e.lines).not.toBeNull();
    expect(e.wedge).toBeNull();
  });

  it('copies vertices so callers cannot mutate the picks', () => {
    const e = angleEntities([a]);
    expect(e.points?.vertices[0]).not.toBe(a);
  });
});
