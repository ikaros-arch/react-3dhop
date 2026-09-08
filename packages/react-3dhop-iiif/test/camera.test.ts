import { describe, expect, it } from 'vitest';
import {
  cameraToView,
  track2view,
  view2track,
  viewToCameraAnnotation,
  type SceneFraming,
  type TrackballState
} from '../src/iiif/camera.js';
import type { ParsedCamera, ParsedModel } from '../src/iiif/types.js';

const framing: SceneFraming = { sceneCenter: [1, 2, 3], sceneRadiusInv: 1 / 4 };
const originFraming: SceneFraming = { sceneCenter: [0, 0, 0], sceneRadiusInv: 1 };

/** Angles are compared modulo a full turn: 190 and -170 are the same heading. */
function expectAngleClose(actual: number, expected: number, precision = 6): void {
  const difference = (((actual - expected) % 360) + 540) % 360 - 180;
  expect(difference).toBeCloseTo(0, precision);
}

function expectStateClose(actual: TrackballState, expected: TrackballState): void {
  expectAngleClose(actual[0], expected[0]);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
  expect(actual[2]).toBeCloseTo(expected[2], 6);
  expect(actual[3]).toBeCloseTo(expected[3], 6);
  expect(actual[4]).toBeCloseTo(expected[4], 6);
  expect(actual[5]).toBeCloseTo(expected[5], 6);
}

describe('view2track / track2view round trip', () => {
  // A spread that crosses the 45-degree branch switch in both directions, and wraps phi past the
  // half-turn where a naive asin-based heading would fold.
  const headings = [-170, -135, -90, -45, 0, 30, 90, 135, 179];
  const elevations = [-85, -60, -46, -44, -20, 0, 20, 44, 46, 60, 85];

  it.each(headings.flatMap((phi) => elevations.map((theta) => [phi, theta] as const)))(
    'recovers phi=%d theta=%d',
    (phi, theta) => {
      const state: TrackballState = [phi, theta, 0.1, -0.2, 0.3, 1.5];
      expectStateClose(view2track(track2view(state, framing), framing), state);
    }
  );

  it('recovers a state with no pan and unit distance', () => {
    const state: TrackballState = [0, 0, 0, 0, 0, 1];
    expectStateClose(view2track(track2view(state, originFraming), originFraming), state);
  });

  it('is not fooled by heading below the horizon', () => {
    // Regression: recovering heading from the up vector divides by sin(theta), which is negative
    // below the horizon. Getting that sign wrong put the camera half a turn around the scene.
    const state: TrackballState = [30, -60, 0, 0, 0, 2];
    const recovered = view2track(track2view(state, originFraming), originFraming);
    expectAngleClose(recovered[0], 30);
    expect(Math.abs(((recovered[0] - 210) % 360 + 540) % 360 - 180)).toBeGreaterThan(1);
  });

  it('recovers a steep heading without a real up vector', () => {
    // A camera parsed from a manifest carries no authored up vector, so heading must come from the
    // view direction for every tilt short of vertical.
    for (const theta of [-80, -60, 60, 80]) {
      const reference = track2view([70, theta, 0, 0, 0, 2], originFraming);
      const withoutUp = { ...reference, up: [0, 1, 0] as [number, number, number] };
      expectAngleClose(view2track(withoutUp, originFraming)[0], 70);
    }
  });

  it('falls back to the up vector when looking straight down', () => {
    const state: TrackballState = [70, 90, 0, 0, 0, 2];
    const recovered = view2track(track2view(state, originFraming), originFraming);
    expectAngleClose(recovered[0], 70);
    expect(recovered[1]).toBeCloseTo(90, 6);
  });

  it('reports heading 0 when looking straight down with world up', () => {
    // Every heading is equivalent here; 0 is as good as any, and must not be NaN.
    const state = view2track(
      { position: [0, 2, 0], target: [0, 0, 0], up: [0, 1, 0], fov: 60 },
      originFraming
    );
    expect(state[0]).toBe(0);
    expect(state[1]).toBeCloseTo(90, 6);
  });

  it('preserves the pan offset through the scene framing', () => {
    const state: TrackballState = [20, 10, 0.5, 0.25, -0.75, 1.2];
    const view = track2view(state, framing);
    // Pan is expressed in scene-radius units relative to the scene centre.
    expect(view.target).toEqual([1 + 0.5 * 4, 2 + 0.25 * 4, 3 - 0.75 * 4]);
    expectStateClose(view2track(view, framing), state);
  });

  it('returns a degenerate state when the camera sits on its own target', () => {
    const state = view2track(
      { position: [1, 2, 3], target: [1, 2, 3], up: [0, 1, 0], fov: 60 },
      framing
    );
    expect(state[5]).toBe(0);
  });
});

describe('track2view', () => {
  it('places a zero-heading, zero-tilt camera on +Z looking back at the target', () => {
    const view = track2view([0, 0, 0, 0, 0, 1], originFraming);
    expect(view.position[0]).toBeCloseTo(0, 9);
    expect(view.position[1]).toBeCloseTo(0, 9);
    expect(view.position[2]).toBeCloseTo(1, 9);
    expect(view.up[1]).toBeCloseTo(1, 9);
  });

  it('swings the camera to +X at 90 degrees of heading', () => {
    const view = track2view([90, 0, 0, 0, 0, 1], originFraming);
    expect(view.position[0]).toBeCloseTo(1, 9);
    expect(view.position[2]).toBeCloseTo(0, 9);
  });

  it('raises the camera at positive tilt', () => {
    const view = track2view([0, 30, 0, 0, 0, 1], originFraming);
    expect(view.position[1]).toBeCloseTo(0.5, 9);
  });

  it('carries the field of view through', () => {
    expect(track2view([0, 0, 0, 0, 0, 1], originFraming, 35).fov).toBe(35);
  });
});

describe('cameraToView', () => {
  const perspective: ParsedCamera = {
    id: 'cam1',
    type: 'PerspectiveCamera',
    position: [0, 1.5, -3],
    fov: 45
  };

  it('looks at the scene centre when the camera names no target', () => {
    const view = cameraToView(perspective, framing);
    expect(view.target).toEqual([1, 2, 3]);
    expect(view.position).toEqual([0, 1.5, -3]);
    expect(view.fov).toBe(45);
  });

  it('prefers an explicit lookAt point', () => {
    const view = cameraToView({ ...perspective, target: [9, 9, 9] }, framing);
    expect(view.target).toEqual([9, 9, 9]);
  });

  it('resolves a lookAt reference to the model it names', () => {
    const model: ParsedModel = {
      id: 'anno/model2',
      url: 'https://example.org/m.nxz',
      position: [2, 0, 0],
      transforms: []
    };
    const view = cameraToView({ ...perspective, lookAtId: 'anno/model2' }, framing, [model]);
    expect(view.target).toEqual([2, 0, 0]);
  });

  it('falls back to the scene centre when the lookAt reference is dangling', () => {
    const view = cameraToView({ ...perspective, lookAtId: 'anno/missing' }, framing, []);
    expect(view.target).toEqual([1, 2, 3]);
  });

  it('defaults a perspective camera without a field of view to 60 degrees', () => {
    const view = cameraToView({ ...perspective, fov: undefined }, framing);
    expect(view.fov).toBe(60);
  });

  it('reports an orthographic camera with the zero-fov sentinel', () => {
    const view = cameraToView({ ...perspective, type: 'OrthographicCamera' }, framing);
    expect(view.fov).toBe(0);
  });
});

describe('viewToCameraAnnotation', () => {
  const view = {
    position: [1.23456, -0.5, 2] as [number, number, number],
    target: [0.1111, 0, 0] as [number, number, number],
    up: [0, 1, 0] as [number, number, number],
    fov: 47.25
  };

  it('emits a perspective camera annotation targeting the scene', () => {
    const annotation = viewToCameraAnnotation(view, {
      idBase: 'https://example.org/x',
      label: 'Front',
      sceneId: 'https://example.org/scene/1'
    });

    expect(annotation.type).toBe('Annotation');

    const body = (annotation.body as Record<string, unknown>[])[0];
    expect(body.type).toBe('PerspectiveCamera');
    expect(body.label).toEqual({ en: ['Front'] });
    expect(body.lookAt).toEqual({ type: 'PointSelector', x: 0.111, y: 0, z: 0 });
    expect(body.fieldOfView).toBe(47.3);

    const target = (annotation.target as Record<string, unknown>[])[0];
    expect((target.source as Record<string, unknown>).id).toBe('https://example.org/scene/1');
    expect((target.selector as Record<string, unknown>[])[0]).toEqual({
      type: 'PointSelector',
      x: 1.235,
      y: -0.5,
      z: 2
    });
  });

  it('omits the field of view for an orthographic camera', () => {
    const annotation = viewToCameraAnnotation({ ...view, fov: 0 });
    const body = (annotation.body as Record<string, unknown>[])[0];
    expect(body.type).toBe('OrthographicCamera');
    expect(body).not.toHaveProperty('fieldOfView');
  });

  it('round-trips through the parser back to the same view', () => {
    // The user-visible contract: a saved view pasted into a manifest reproduces itself.
    const state: TrackballState = [123, -55, 0.2, 0.1, -0.4, 1.8];
    const original = track2view(state, framing);
    const annotation = viewToCameraAnnotation(original, { sceneId: 'https://example.org/scene/1' });

    const body = (annotation.body as Record<string, unknown>[])[0];
    const lookAt = body.lookAt as { x: number; y: number; z: number };
    const selector = ((annotation.target as Record<string, unknown>[])[0].selector as Array<{
      x: number;
      y: number;
      z: number;
    }>)[0];

    const reparsed = cameraToView(
      {
        type: 'PerspectiveCamera',
        position: [selector.x, selector.y, selector.z],
        target: [lookAt.x, lookAt.y, lookAt.z],
        fov: body.fieldOfView as number
      },
      framing
    );

    // Coordinates are rounded to three decimals on the way out, so this is not exact.
    expectStateClose_loose(view2track(reparsed, framing), state);
  });
});

/**
 * Same as {@link expectStateClose}, relaxed for the 3-decimal rounding the annotation applies to
 * every coordinate. At a scene radius of 4 that is a millimetre of slop on positions, which works
 * out to a few hundredths of a degree on the recovered angles.
 */
function expectStateClose_loose(actual: TrackballState, expected: TrackballState): void {
  expectAngleClose(actual[0], expected[0], 1);
  expect(actual[1]).toBeCloseTo(expected[1], 1);
  expect(actual[2]).toBeCloseTo(expected[2], 3);
  expect(actual[3]).toBeCloseTo(expected[3], 3);
  expect(actual[4]).toBeCloseTo(expected[4], 3);
  expect(actual[5]).toBeCloseTo(expected[5], 3);
}
