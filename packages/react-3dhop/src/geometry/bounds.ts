import type { PresenterInstance, SceneBounds, SceneMeshRuntime, Vector3 } from '../viewer/types.js';
import { IDENTITY, isMat4, maxScale, multiply, transformPoint, type Mat4 } from './mat4.js';

type Accumulator = {
  min: Vector3;
  max: Vector3;
  count: number;
  fellBackToSpheres: boolean;
};

function emptyAccumulator(): Accumulator {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    count: 0,
    fellBackToSpheres: false
  };
}

function extend(acc: Accumulator, p: Vector3) {
  for (let i = 0; i < 3; i++) {
    if (p[i] < acc.min[i]) acc.min[i] = p[i];
    if (p[i] > acc.max[i]) acc.max[i] = p[i];
  }
  acc.count++;
}

/** The eight corners of an axis-aligned box. */
function boxCorners(min: number[], max: number[]): Vector3[] {
  const corners: Vector3[] = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        corners.push([x, y, z]);
      }
    }
  }
  return corners;
}

function matrixOf(holder: { transform?: { matrix?: number[] } } | undefined): Mat4 {
  const m = holder?.transform?.matrix;
  return isMat4(m) ? m : IDENTITY;
}

/**
 * Adds one mesh's geometry to the accumulator under the given world matrix. Prefers real
 * geometry (Nexus base-level vertices, PLY bounding box); falls back to the bounding sphere 3DHOP
 * itself uses, which is coarse but always available once the mesh header has loaded.
 */
function accumulateMesh(acc: Accumulator, mesh: SceneMeshRuntime, world: Mat4) {
  const renderable = mesh.renderable;
  if (!renderable) return;

  const basev = renderable.mesh?.basev;
  if (basev && basev.length >= 3) {
    for (let i = 0; i + 2 < basev.length; i += 3) {
      extend(acc, transformPoint(world, [basev[i], basev[i + 1], basev[i + 2]]));
    }
    return;
  }

  const box = renderable.boundingBox;
  if (box && Array.isArray(box.min) && Array.isArray(box.max)) {
    boxCorners(box.min, box.max).forEach((corner) => extend(acc, transformPoint(world, corner)));
    return;
  }

  const center = renderable.datasetCenter;
  const radius = renderable.datasetRadius;
  if (Array.isArray(center) && center.length >= 3 && typeof radius === 'number' && radius > 0) {
    const c = transformPoint(world, [center[0], center[1], center[2]]);
    const r = radius * maxScale(world);
    extend(acc, [c[0] - r, c[1] - r, c[2] - r]);
    extend(acc, [c[0] + r, c[1] + r, c[2] + r]);
    acc.fellBackToSpheres = true;
  }
}

/**
 * Axis-aligned bounds of every visible model instance, in the space 3DHOP draws in
 * (`space.transform · instance.transform · mesh.transform`). Returns `null` before the scene
 * has any renderable geometry.
 */
export function computeSceneBounds(presenter: PresenterInstance): SceneBounds | null {
  const scene = presenter._scene;
  if (!scene?.meshes || !scene.modelInstances) return null;

  const spaceMatrix = matrixOf(scene.space);
  const acc = emptyAccumulator();

  for (const instance of Object.values(scene.modelInstances)) {
    if (!instance || instance.visible === false || !instance.mesh) continue;
    const mesh = scene.meshes[instance.mesh];
    if (!mesh) continue;
    const world = multiply(multiply(spaceMatrix, matrixOf(instance)), matrixOf(mesh));
    accumulateMesh(acc, mesh, world);
  }

  if (acc.count === 0) return null;
  return finalize(acc);
}

function finalize(acc: Accumulator): SceneBounds {
  const size: Vector3 = [acc.max[0] - acc.min[0], acc.max[1] - acc.min[1], acc.max[2] - acc.min[2]];
  const center: Vector3 = [
    (acc.min[0] + acc.max[0]) / 2,
    (acc.min[1] + acc.max[1]) / 2,
    (acc.min[2] + acc.max[2]) / 2
  ];
  return {
    min: acc.min,
    max: acc.max,
    center,
    size,
    radius: Math.hypot(size[0], size[1], size[2]) / 2,
    source: acc.fellBackToSpheres ? 'spheres' : 'vertices'
  };
}
