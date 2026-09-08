import { describe, expect, it } from 'vitest';
import { identity, transformPoint, type Mat4 } from '../src/iiif/mat4.js';
import { buildModelMatrix, composeTransforms, transformToMatrix } from '../src/iiif/transforms.js';
import type { IIIFTransform, Vector3 } from '../src/iiif/types.js';

function expectPoint(actual: Vector3, expected: Vector3, precision = 9): void {
  expect(actual[0]).toBeCloseTo(expected[0], precision);
  expect(actual[1]).toBeCloseTo(expected[1], precision);
  expect(actual[2]).toBeCloseTo(expected[2], precision);
}

/** The matrix must be in SpiderGL's column-major layout, with translation in elements 12-14. */
function translationOf(m: Mat4): Vector3 {
  return [m[12], m[13], m[14]];
}

describe('transformToMatrix', () => {
  it('builds a scale', () => {
    const m = transformToMatrix({ type: 'ScaleTransform', x: 2, y: 3, z: 4 });
    expectPoint(transformPoint(m, [1, 1, 1]), [2, 3, 4]);
  });

  it('defaults missing scale components to 1, not 0', () => {
    const m = transformToMatrix({ type: 'ScaleTransform', y: 5 });
    expectPoint(transformPoint(m, [1, 1, 1]), [1, 5, 1]);
  });

  it('builds a translation in the column-major slots SpiderGL expects', () => {
    const m = transformToMatrix({ type: 'TranslateTransform', x: 1, y: 2, z: 3 });
    expect(translationOf(m)).toEqual([1, 2, 3]);
    expectPoint(transformPoint(m, [0, 0, 0]), [1, 2, 3]);
  });

  it('defaults missing translation components to 0', () => {
    const m = transformToMatrix({ type: 'TranslateTransform', z: 3 });
    expect(translationOf(m)).toEqual([0, 0, 3]);
  });

  it('rotates 90 degrees about X right-handed', () => {
    const m = transformToMatrix({ type: 'RotateTransform', x: 90 });
    expectPoint(transformPoint(m, [0, 0, 1]), [0, -1, 0]);
  });

  it('rotates 90 degrees about Y right-handed', () => {
    const m = transformToMatrix({ type: 'RotateTransform', y: 90 });
    expectPoint(transformPoint(m, [0, 0, 1]), [1, 0, 0]);
  });

  it('rotates 90 degrees about Z right-handed', () => {
    const m = transformToMatrix({ type: 'RotateTransform', z: 90 });
    expectPoint(transformPoint(m, [1, 0, 0]), [0, 1, 0]);
  });

  it('accepts the axis-angle form', () => {
    const m = transformToMatrix({ type: 'RotateTransform', axis: 'y', angle: 90 });
    expectPoint(transformPoint(m, [0, 0, 1]), [1, 0, 0]);
  });

  it('treats the axis-angle form as equivalent to the single-axis Euler form', () => {
    const axisAngle = transformToMatrix({ type: 'RotateTransform', axis: 'x', angle: 37 });
    const euler = transformToMatrix({ type: 'RotateTransform', x: 37 });
    axisAngle.forEach((value, index) => expect(value).toBeCloseTo(euler[index], 12));
  });

  it('composes Euler angles Z, then Y, then X', () => {
    // Matching how 3DHOP's presenter interprets its own rotation triple.
    const m = transformToMatrix({ type: 'RotateTransform', x: 90, y: 90, z: 0 });
    // X first takes (0,0,1) to (0,-1,0); Y then leaves it there.
    expectPoint(transformPoint(m, [0, 0, 1]), [0, -1, 0]);
  });

  it('returns the identity for an unrecognised transform type', () => {
    expect(transformToMatrix({ type: 'ShearTransform', x: 5 })).toEqual(identity());
  });
});

describe('composeTransforms', () => {
  it('returns the identity for an empty or missing list', () => {
    expect(composeTransforms([])).toEqual(identity());
    expect(composeTransforms(undefined)).toEqual(identity());
  });

  it('applies the first listed transform first', () => {
    const transforms: IIIFTransform[] = [
      { type: 'TranslateTransform', x: 1 },
      { type: 'RotateTransform', z: 90 }
    ];
    // Translate to (1,0,0), then rotate about Z to (0,1,0).
    expectPoint(transformPoint(composeTransforms(transforms), [0, 0, 0]), [0, 1, 0]);
  });

  it('gives a different result when the same transforms are reordered', () => {
    // The regression a flattened translation/rotation/scale triple cannot represent: with a triple,
    // both orders collapse to the same numbers.
    const translateThenRotate: IIIFTransform[] = [
      { type: 'TranslateTransform', x: 1 },
      { type: 'RotateTransform', z: 90 }
    ];
    const rotateThenTranslate: IIIFTransform[] = [
      { type: 'RotateTransform', z: 90 },
      { type: 'TranslateTransform', x: 1 }
    ];

    expectPoint(transformPoint(composeTransforms(translateThenRotate), [0, 0, 0]), [0, 1, 0]);
    expectPoint(transformPoint(composeTransforms(rotateThenTranslate), [0, 0, 0]), [1, 0, 0]);
  });

  it('scales a translation authored before it, but not one authored after', () => {
    const scaleLast: IIIFTransform[] = [
      { type: 'TranslateTransform', x: 2 },
      { type: 'ScaleTransform', x: 3, y: 3, z: 3 }
    ];
    const scaleFirst: IIIFTransform[] = [
      { type: 'ScaleTransform', x: 3, y: 3, z: 3 },
      { type: 'TranslateTransform', x: 2 }
    ];

    expectPoint(transformPoint(composeTransforms(scaleLast), [0, 0, 0]), [6, 0, 0]);
    expectPoint(transformPoint(composeTransforms(scaleFirst), [0, 0, 0]), [2, 0, 0]);
  });

  it('does not fold rotations about different axes into one Euler triple', () => {
    // Flattening summed the angles per axis, which discards the order they were applied in. The
    // triple always evaluates Z, then Y, then X, so a list authored Y-then-X cannot be expressed
    // as one — note that a list authored X-then-Y coincidentally can, which is why this case is
    // the one that catches the regression.
    const composed = composeTransforms([
      { type: 'RotateTransform', y: 90 },
      { type: 'RotateTransform', x: 90 }
    ]);
    const flattened = transformToMatrix({ type: 'RotateTransform', x: 90, y: 90 });

    expectPoint(transformPoint(composed, [1, 0, 0]), [0, 1, 0]);
    expectPoint(transformPoint(flattened, [1, 0, 0]), [0, 0, -1]);
  });

  it('does sum coaxial rotations, where order genuinely does not matter', () => {
    const composed = composeTransforms([
      { type: 'RotateTransform', z: 30 },
      { type: 'RotateTransform', z: 60 }
    ]);
    const single = transformToMatrix({ type: 'RotateTransform', z: 90 });
    composed.forEach((value, index) => expect(value).toBeCloseTo(single[index], 12));
  });

  it('does not let a later scale overwrite an earlier one', () => {
    const transforms: IIIFTransform[] = [
      { type: 'ScaleTransform', x: 2, y: 2, z: 2 },
      { type: 'ScaleTransform', x: 3, y: 3, z: 3 }
    ];
    // Flattening kept only the last scale, giving 3 instead of 6.
    expectPoint(transformPoint(composeTransforms(transforms), [1, 0, 0]), [6, 0, 0]);
  });

  it('reproduces the advanced fixture\'s two orderings distinctly', () => {
    // Both annotations carry a 1.5/0.5 scale, a rotation and a translation, in different orders.
    const model2: IIIFTransform[] = [
      { type: 'ScaleTransform', x: 1.5, y: 1.5, z: 1.5 },
      { type: 'RotateTransform', x: -90, y: -90, z: 0 },
      { type: 'TranslateTransform', x: 0, y: 0.5, z: 0 }
    ];
    const model3: IIIFTransform[] = [
      { type: 'ScaleTransform', x: 0.5, y: 0.5, z: 0.5 },
      { type: 'TranslateTransform', x: 3, y: 0, z: -1 },
      { type: 'RotateTransform', x: 90, y: 0, z: 180 }
    ];

    // model2 translates after rotating, so the offset is left unrotated.
    expectPoint(transformPoint(composeTransforms(model2), [0, 0, 0]), [0, 0.5, 0]);
    // model3 rotates after translating, so its offset is carried through the rotation: X+90 takes
    // (3,0,-1) to (3,1,0), then Z+180 takes that to (-3,-1,0).
    expectPoint(transformPoint(composeTransforms(model3), [0, 0, 0]), [-3, -1, 0]);
  });
});

describe('buildModelMatrix', () => {
  it('is the identity with no options', () => {
    expect(buildModelMatrix({})).toEqual(identity());
  });

  it('places the model at the point selector', () => {
    const m = buildModelMatrix({ position: [1, 2, 3] });
    expect(translationOf(m)).toEqual([1, 2, 3]);
  });

  it('applies the transform list before the point selector', () => {
    // The selector positions the already-transformed model; it must not be rotated by the list.
    const m = buildModelMatrix({
      position: [10, 0, 0],
      transforms: [{ type: 'RotateTransform', y: 90 }]
    });
    expectPoint(transformPoint(m, [0, 0, 1]), [11, 0, 0]);
  });

  it('scales the point selector along with the geometry', () => {
    // The whole scene converts from the manifest unit to the display unit, positions included.
    const m = buildModelMatrix({ position: [2, 0, 0], sceneScale: 1000 });
    expect(translationOf(m)).toEqual([2000, 0, 0]);
  });

  it('scales translations inside the transform list too', () => {
    const m = buildModelMatrix({
      transforms: [{ type: 'TranslateTransform', x: 2 }],
      sceneScale: 1000
    });
    expect(translationOf(m)).toEqual([2000, 0, 0]);
  });

  it('applies a model-specific geometry scale without moving the model', () => {
    // A model authored in mm inside a manifest authored in m: only the mesh shrinks.
    const m = buildModelMatrix({
      position: [2, 0, 0],
      sceneScale: 1,
      geometryScale: 0.001
    });
    expect(translationOf(m)).toEqual([2, 0, 0]);
    expectPoint(transformPoint(m, [1000, 0, 0]), [3, 0, 0]);
  });

  it('leaves the inner factor out when the model does not override its unit', () => {
    const withDefault = buildModelMatrix({ position: [1, 1, 1], sceneScale: 10 });
    const explicit = buildModelMatrix({ position: [1, 1, 1], sceneScale: 10, geometryScale: 10 });
    expect(withDefault).toEqual(explicit);
  });

  it('composes as S(sceneScale) . T(position) . L . S(geometryScale / sceneScale)', () => {
    const m = buildModelMatrix({
      position: [2, 0, 0],
      transforms: [{ type: 'ScaleTransform', x: 3, y: 3, z: 3 }],
      sceneScale: 10,
      geometryScale: 5
    });
    // (1,0,0) -> x0.5 -> x3 -> +2 -> x10
    expectPoint(transformPoint(m, [1, 0, 0]), [35, 0, 0]);
  });

  it('does not divide by zero on a degenerate scene scale', () => {
    const m = buildModelMatrix({ position: [1, 0, 0], sceneScale: 0, geometryScale: 5 });
    expect(m.every(Number.isFinite)).toBe(true);
  });
});
