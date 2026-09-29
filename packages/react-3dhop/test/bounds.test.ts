import { describe, expect, it } from 'vitest';
import { computeSceneBounds } from '../src/geometry/bounds.js';
import { createMockPresenter, nexusMesh, plyMesh, sphereOnlyMesh } from './mockPresenter.js';

const translate = (x: number, y: number, z: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const scale = (s: number) => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];

describe('computeSceneBounds', () => {
  it('returns null with no geometry', () => {
    const presenter = createMockPresenter();
    expect(computeSceneBounds(presenter)).toBeNull();
  });

  it('bounds Nexus base vertices and reports the source as vertices', () => {
    const presenter = createMockPresenter({
      meshes: { m: nexusMesh([[-1, -2, -3], [4, 5, 6], [0, 0, 0]]) },
      modelInstances: { i: { mesh: 'm' } }
    });
    const bounds = computeSceneBounds(presenter)!;
    expect(bounds.min).toEqual([-1, -2, -3]);
    expect(bounds.max).toEqual([4, 5, 6]);
    expect(bounds.center).toEqual([1.5, 1.5, 1.5]);
    expect(bounds.size).toEqual([5, 7, 9]);
    expect(bounds.source).toBe('vertices');
  });

  it('applies instance and mesh transforms', () => {
    const presenter = createMockPresenter({
      meshes: { m: nexusMesh([[0, 0, 0], [1, 1, 1]], scale(2)) },
      modelInstances: { i: { mesh: 'm', transform: { matrix: translate(10, 0, 0) } } }
    });
    const bounds = computeSceneBounds(presenter)!;
    // scale first (mesh), then translate (instance)
    expect(bounds.min).toEqual([10, 0, 0]);
    expect(bounds.max).toEqual([12, 2, 2]);
  });

  it('applies the space transform on top', () => {
    const presenter = createMockPresenter({
      meshes: { m: nexusMesh([[0, 0, 0], [1, 1, 1]]) },
      modelInstances: { i: { mesh: 'm' } },
      space: { transform: { matrix: translate(0, 0, 5) } }
    });
    expect(computeSceneBounds(presenter)!.min).toEqual([0, 0, 5]);
  });

  it('skips invisible instances', () => {
    const presenter = createMockPresenter({
      meshes: { a: nexusMesh([[0, 0, 0], [1, 1, 1]]), b: nexusMesh([[100, 100, 100]]) },
      modelInstances: { ia: { mesh: 'a' }, ib: { mesh: 'b', visible: false } }
    });
    expect(computeSceneBounds(presenter)!.max).toEqual([1, 1, 1]);
  });

  it('uses the PLY bounding box corners', () => {
    const presenter = createMockPresenter({
      meshes: { p: plyMesh([-1, -1, -1], [1, 1, 1]) },
      modelInstances: { i: { mesh: 'p', transform: { matrix: translate(1, 1, 1) } } }
    });
    const bounds = computeSceneBounds(presenter)!;
    expect(bounds.min).toEqual([0, 0, 0]);
    expect(bounds.max).toEqual([2, 2, 2]);
    expect(bounds.source).toBe('vertices');
  });

  it('falls back to the bounding sphere and says so', () => {
    const presenter = createMockPresenter({
      meshes: { s: sphereOnlyMesh([0, 0, 0], 3) },
      modelInstances: { i: { mesh: 's', transform: { matrix: scale(2) } } }
    });
    const bounds = computeSceneBounds(presenter)!;
    expect(bounds.min).toEqual([-6, -6, -6]);
    expect(bounds.max).toEqual([6, 6, 6]);
    expect(bounds.radius).toBeCloseTo(Math.hypot(12, 12, 12) / 2);
    expect(bounds.source).toBe('spheres');
  });

  it('marks mixed scenes as sphere-derived', () => {
    const presenter = createMockPresenter({
      meshes: { a: nexusMesh([[0, 0, 0]]), s: sphereOnlyMesh([5, 5, 5], 1) },
      modelInstances: { ia: { mesh: 'a' }, is: { mesh: 's' } }
    });
    expect(computeSceneBounds(presenter)!.source).toBe('spheres');
  });
});
