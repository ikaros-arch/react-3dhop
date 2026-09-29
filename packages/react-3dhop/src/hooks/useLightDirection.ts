import { useCallback, useEffect, useState } from 'react';
import { useThreeDHopViewer } from '../viewer/context.js';
import type { Vector3 } from '../viewer/types.js';

export type UseLightDirectionResult = {
  /** 3DHOP's `_lightDirection`: a unit vector pointing towards the light; `null` before init. */
  direction: Vector3 | null;
  /**
   * Sets the light from a point in the unit disc, `x`/`y` in [-0.5, 0.5] with `y` pointing down
   * (3DHOP's convention: it negates both when storing `_lightDirection`).
   */
  setFromDisc: (x: number, y: number) => void;
  /** Whether 3DHOP's drag-on-canvas light mode (`LightControl`) is on. */
  isLightTrackballEnabled: boolean;
};

/** Live light direction plus a setter, kept in sync with `LightControl` and `HomeControl`. */
export function useLightDirection(): UseLightDirectionResult {
  const { presenter, registerLightObserver, registerTrackballObserver } = useThreeDHopViewer();
  const [direction, setDirection] = useState<Vector3 | null>(null);
  const [isLightTrackballEnabled, setLightTrackballEnabled] = useState(false);

  useEffect(() => registerLightObserver(setDirection), [registerLightObserver]);

  // The light-trackball flag has no observer of its own; the trackball observer fires on every
  // interaction, which is often enough to keep this in step.
  useEffect(
    () =>
      registerTrackballObserver(() => {
        if (presenter) setLightTrackballEnabled(Boolean(presenter.isLightTrackballEnabled()));
      }),
    [presenter, registerTrackballObserver]
  );

  const setFromDisc = useCallback(
    (x: number, y: number) => {
      presenter?.rotateLight?.(x, y);
    },
    [presenter]
  );

  return { direction, setFromDisc, isLightTrackballEnabled };
}
