import { useCallback, useMemo } from 'react';
import { useThreeDHopViewer } from '../viewer/context.js';
import {
  VIEW_PRESETS,
  toTrackballState,
  viewPresetState,
  type PartialTrackballState,
  type TrackballState,
  type ViewPreset,
  type ViewStateOptions
} from '../geometry/presets.js';

const DEFAULT_TRACKBALL_STATE: TrackballState = [35, 15, 0, 0, 0, 2.5];

export type UseViewPresetsOptions = ViewStateOptions & {
  /** Animation length in seconds; `0` jumps immediately (default 0.8). */
  animationSeconds?: number;
};

export type UseViewPresetsResult = {
  /** Move the camera to a named preset or an explicit partial trackball state. */
  viewFrom: (target: ViewPreset | PartialTrackballState, overrides?: UseViewPresetsOptions) => void;
  /** The presets available, for building your own buttons. */
  presets: typeof VIEW_PRESETS;
};

/**
 * Programmatic camera presets (front/back/left/right/top/bottom or any phi/theta) for the
 * TurnTable trackball, animated through `animateToTrackballPosition` when available.
 */
export function useViewPresets(defaults: UseViewPresetsOptions = {}): UseViewPresetsResult {
  const { presenter } = useThreeDHopViewer();

  const viewFrom = useCallback(
    (target: ViewPreset | PartialTrackballState, overrides: UseViewPresetsOptions = {}) => {
      if (!presenter) return;
      const { animationSeconds = 0.8, ...stateOptions } = { ...defaults, ...overrides };
      const current = toTrackballState(presenter.getTrackballPosition?.(), DEFAULT_TRACKBALL_STATE);
      const next = viewPresetState(target, current, stateOptions);
      const duration = Number.isFinite(animationSeconds) && animationSeconds > 0 ? animationSeconds : 0;
      if (duration > 0 && typeof presenter.animateToTrackballPosition === 'function') {
        presenter.animateToTrackballPosition(next, duration);
      } else if (typeof presenter.setTrackballPosition === 'function') {
        presenter.setTrackballPosition(next);
        presenter.repaint?.();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presenter, defaults.animationSeconds, defaults.preservePanAndDistance, defaults.targetDistance]
  );

  return useMemo(() => ({ viewFrom, presets: VIEW_PRESETS }), [viewFrom]);
}
