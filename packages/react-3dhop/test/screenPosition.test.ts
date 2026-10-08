import { describe, expect, it } from 'vitest';
import { getAnnotationScreenPosition } from '../src/utils/screenPosition.js';
import { IDENTITY, translation } from '../src/geometry/mat4.js';
import type { PresenterInstance } from '../src/viewer/types.js';

function presenterWith(overrides: {
  spotMatrix?: number[];
  mvp?: number[];
  width?: number;
  height?: number;
  spaceMatrix?: number[];
}): PresenterInstance {
  return {
    setScene: () => {},
    resetTrackball: () => {},
    zoomIn: () => {},
    zoomOut: () => {},
    enableLightTrackball: () => {},
    isLightTrackballEnabled: () => false,
    ui: { width: overrides.width, height: overrides.height },
    xform: { modelViewProjectionMatrix: overrides.mvp },
    _scene: {
      spots: overrides.spotMatrix ? { a: { transform: { matrix: overrides.spotMatrix } } } : {},
      space: overrides.spaceMatrix ? { transform: { matrix: overrides.spaceMatrix } } : undefined
    }
  } as unknown as PresenterInstance;
}

describe('getAnnotationScreenPosition', () => {
  it('returns null for an id that is not a registered spot', () => {
    const presenter = presenterWith({ mvp: IDENTITY, width: 800, height: 600 });
    expect(getAnnotationScreenPosition(presenter, 'missing')).toBeNull();
  });

  it('returns null when the presenter has not drawn a frame yet (no matrices)', () => {
    const presenter = presenterWith({ spotMatrix: translation([0, 0, 0]) });
    expect(getAnnotationScreenPosition(presenter, 'a')).toBeNull();
  });

  it('projects a spot at the origin to the centre of the canvas under an identity camera', () => {
    const presenter = presenterWith({ spotMatrix: translation([0, 0, 0]), mvp: IDENTITY, width: 800, height: 600 });
    expect(getAnnotationScreenPosition(presenter, 'a')).toEqual({ x: 400, y: 300, visible: true });
  });

  it('applies the scene space transform before projecting', () => {
    const presenter = presenterWith({
      spotMatrix: translation([0, 0, 0]),
      spaceMatrix: translation([1, 0, 0]),
      mvp: IDENTITY,
      width: 800,
      height: 600
    });
    // Shifted by 1 in NDC X under an identity projection lands exactly on the right edge.
    expect(getAnnotationScreenPosition(presenter, 'a')).toEqual({ x: 800, y: 300, visible: true });
  });

  it('reports not visible when the point is behind the camera', () => {
    const behindCamera = [...IDENTITY];
    behindCamera[15] = -1; // forces w negative regardless of position
    const presenter = presenterWith({ spotMatrix: translation([0, 0, 0]), mvp: behindCamera, width: 800, height: 600 });
    expect(getAnnotationScreenPosition(presenter, 'a')).toEqual({ x: 0, y: 0, visible: false });
  });

  it('reports not visible when the point falls outside the view frustum', () => {
    const presenter = presenterWith({ spotMatrix: translation([5, 0, 0]), mvp: IDENTITY, width: 800, height: 600 });
    const result = getAnnotationScreenPosition(presenter, 'a');
    expect(result?.visible).toBe(false);
  });
});
