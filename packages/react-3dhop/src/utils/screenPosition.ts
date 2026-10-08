import type { PresenterInstance, Vector3 } from '../viewer/types.js';
import { IDENTITY, transformPoint, type Mat4 } from '../geometry/mat4.js';

export type AnnotationScreenPosition = {
  /** Pixel coordinates relative to the canvas's own top-left corner, not the page. */
  x: number;
  y: number;
  /** False once the point is behind the camera or outside the current view frustum. */
  visible: boolean;
};

/** `m * [p, 1]`, without dehomogenising - callers that need the raw `w` (e.g. to tell whether a
 * point is behind the camera) want this instead of `transformPoint`, which assumes `w` is just
 * noise to discard. */
function projectHomogeneous(m: Mat4, p: Vector3): [number, number, number, number] {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [x, y, z, w];
}

/**
 * Projects an already-registered spot's position onto the canvas. Call this again from a
 * `registerTrackballObserver` callback to keep a UI element (e.g. a popup) glued to the spot as
 * the camera orbits/pans/zooms - 3DHOP recomputes its view/projection matrices on every trackball
 * change, so this reflects the camera as of the last rendered frame, which updates many times a
 * second during a drag.
 *
 * Returns `null` if `annotationId` isn't a currently-registered spot, or the presenter hasn't
 * drawn a frame yet (no matrices to project with).
 */
export function getAnnotationScreenPosition(
  presenter: PresenterInstance,
  annotationId: string
): AnnotationScreenPosition | null {
  const spot = presenter._scene?.spots?.[annotationId];
  const matrix = spot?.transform?.matrix;
  const mvp = presenter.xform?.modelViewProjectionMatrix;
  const width = presenter.ui?.width;
  const height = presenter.ui?.height;
  if (!matrix || matrix.length < 16 || !mvp || mvp.length < 16 || !width || !height) {
    return null;
  }

  const spaceMatrix = (presenter._scene?.space?.transform?.matrix as Mat4 | undefined) ?? IDENTITY;
  const localPos: Vector3 = [matrix[12], matrix[13], matrix[14]];
  const worldPos = transformPoint(spaceMatrix, localPos);
  const [cx, cy, cz, cw] = projectHomogeneous(mvp as Mat4, worldPos);

  if (cw <= 0) {
    return { x: 0, y: 0, visible: false };
  }

  const ndcX = cx / cw;
  const ndcY = cy / cw;
  const ndcZ = cz / cw;

  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1 - (ndcY * 0.5 + 0.5)) * height,
    visible: ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1 && ndcZ >= -1 && ndcZ <= 1
  };
}
