import {
  degToRad,
  identity,
  multiply,
  rotationAngleAxis,
  scaling,
  translation,
  type Mat4
} from './mat4.js';
import type { IIIFTransform, Vector3 } from './types.js';

/**
 * Converts a single IIIF transform to a matrix.
 *
 * `RotateTransform` has two authored forms: per-axis Euler angles (`{ x, y, z }`, degrees) and a
 * single axis-angle (`{ axis: 'y', angle: 45 }`). The Euler form is composed Z, then Y, then X,
 * matching how 3DHOP's presenter interprets its own `rotation` triple.
 */
export function transformToMatrix(transform: IIIFTransform): Mat4 {
  switch (transform.type) {
    case 'ScaleTransform':
      return scaling([transform.x ?? 1, transform.y ?? 1, transform.z ?? 1]);

    case 'TranslateTransform':
      return translation([transform.x ?? 0, transform.y ?? 0, transform.z ?? 0]);

    case 'RotateTransform': {
      if (transform.axis !== undefined || transform.angle !== undefined) {
        const angle = degToRad(transform.angle ?? 0);
        switch (transform.axis) {
          case 'x':
            return rotationAngleAxis(angle, [1, 0, 0]);
          case 'y':
            return rotationAngleAxis(angle, [0, 1, 0]);
          case 'z':
          default:
            return rotationAngleAxis(angle, [0, 0, 1]);
        }
      }

      const rx = rotationAngleAxis(degToRad(transform.x ?? 0), [1, 0, 0]);
      const ry = rotationAngleAxis(degToRad(transform.y ?? 0), [0, 1, 0]);
      const rz = rotationAngleAxis(degToRad(transform.z ?? 0), [0, 0, 1]);
      return multiply(multiply(rz, ry), rx);
    }

    default:
      return identity();
  }
}

/**
 * Composes an ordered IIIF transform list into a single matrix.
 *
 * IIIF applies the transforms in the order they are listed, so the first entry acts on the model
 * first. In matrix terms that makes it the rightmost factor: `Tn · … · T2 · T1`.
 *
 * This is why the list must be composed rather than flattened into a single translation/rotation/
 * scale triple: with a flattened triple, `translate` then `rotate` and `rotate` then `translate`
 * produce the same result, when they should not.
 */
export function composeTransforms(transforms: readonly IIIFTransform[] | undefined): Mat4 {
  if (!transforms || transforms.length === 0) {
    return identity();
  }

  return transforms.reduce<Mat4>(
    (accumulated, transform) => multiply(transformToMatrix(transform), accumulated),
    identity()
  );
}

export type ModelMatrixOptions = {
  /** Placement of the model in scene coordinates, from the annotation's `PointSelector`. */
  position?: Vector3;
  /** The annotation's `transform` list, in authored order. */
  transforms?: readonly IIIFTransform[];
  /**
   * Converts scene-level coordinates — the `PointSelector` and any `TranslateTransform` — from the
   * manifest's measure unit to the display unit.
   */
  sceneScale?: number;
  /**
   * Converts the mesh's own vertex coordinates from the unit that model is authored in to the
   * display unit. Differs from `sceneScale` only when the annotation overrides `measureUnit`.
   */
  geometryScale?: number;
};

/**
 * Builds the full model matrix for one IIIF model annotation.
 *
 * ```text
 * M = S(sceneScale) · T(position) · L · S(geometryScale / sceneScale)
 * ```
 *
 * Read right to left, that is: bring the mesh's vertices from their own unit into the manifest's
 * unit, apply the manifest's ordered transform list, place the result at the `PointSelector`
 * position, then convert the whole scene from the manifest's unit to the display unit. Keeping the
 * unit conversions on the outside and inside — rather than folding them into the instance scale —
 * is what makes positions and translations scale correctly alongside the geometry.
 *
 * When the model does not override `measureUnit`, `geometryScale / sceneScale` is 1 and the
 * innermost factor drops out.
 */
export function buildModelMatrix({
  position = [0, 0, 0],
  transforms,
  sceneScale = 1,
  geometryScale = sceneScale
}: ModelMatrixOptions): Mat4 {
  const relativeGeometryScale = sceneScale === 0 ? 1 : geometryScale / sceneScale;

  let matrix = composeTransforms(transforms);

  if (relativeGeometryScale !== 1) {
    matrix = multiply(matrix, scaling([relativeGeometryScale, relativeGeometryScale, relativeGeometryScale]));
  }

  if (position[0] !== 0 || position[1] !== 0 || position[2] !== 0) {
    matrix = multiply(translation(position), matrix);
  }

  if (sceneScale !== 1) {
    matrix = multiply(scaling([sceneScale, sceneScale, sceneScale]), matrix);
  }

  return matrix;
}
