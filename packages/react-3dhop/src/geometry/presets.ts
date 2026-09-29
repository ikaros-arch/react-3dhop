/**
 * Named camera orientations for 3DHOP's TurnTable trackball, shared by `CubeNavigation`,
 * `ViewPresetButtons` and `useViewPresets`.
 */

/** `[phi, theta, panX, panY, panZ, distance]` as 3DHOP's TurnTable trackball reports it. */
export type TrackballState = [number, number, number, number, number, number];

export type PartialTrackballState = {
  phi?: number;
  theta?: number;
  panX?: number;
  panY?: number;
  panZ?: number;
  distance?: number;
};

export type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

export const VIEW_PRESET_ORDER: readonly ViewPreset[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/** Azimuth (`phi`) / elevation (`theta`) in degrees for each preset. */
export const VIEW_PRESETS: Record<ViewPreset, { phi: number; theta: number }> = {
  front: { phi: 0, theta: 0 },
  back: { phi: 180, theta: 0 },
  left: { phi: 270, theta: 0 },
  right: { phi: 90, theta: 0 },
  top: { phi: 0, theta: 90 },
  bottom: { phi: 0, theta: -90 }
};

export const VIEW_PRESET_LABELS: Record<ViewPreset, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
  top: 'Top',
  bottom: 'Bottom'
};

/** Wraps an angle into [0, 360); non-finite input becomes 0. */
export function normalizeAngle(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Clamps elevation to the trackball's hemisphere range. */
export function clampTheta(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-90, Math.min(90, value));
}

/** Coerces whatever the presenter returns into a six-value tuple, filling gaps from `fallback`. */
export function toTrackballState(state: readonly number[] | null | undefined, fallback: TrackballState): TrackballState {
  const next: TrackballState = [...fallback];
  if (!Array.isArray(state)) return next;
  for (let i = 0; i < Math.min(state.length, 6); i++) {
    const v = Number(state[i]);
    if (Number.isFinite(v)) next[i] = v;
  }
  return next;
}

export type ViewStateOptions = {
  /** Keep the current pan and distance (default true); otherwise recentre and use `targetDistance`. */
  preservePanAndDistance?: boolean;
  /** Distance used when not preserving (default 1.3). */
  targetDistance?: number;
};

/**
 * The trackball state to move to for `target` (a preset name or explicit partial state), given
 * the `current` state. Angles are normalised/clamped; pan and distance follow `options`.
 */
export function viewPresetState(
  target: ViewPreset | PartialTrackballState,
  current: TrackballState,
  { preservePanAndDistance = true, targetDistance = 1.3 }: ViewStateOptions = {}
): TrackballState {
  const partial: PartialTrackballState = typeof target === 'string' ? VIEW_PRESETS[target] : target;
  const [phi, theta, panX, panY, panZ, distance] = current;
  return [
    normalizeAngle(partial.phi ?? phi),
    clampTheta(partial.theta ?? theta),
    partial.panX ?? (preservePanAndDistance ? panX : 0),
    partial.panY ?? (preservePanAndDistance ? panY : 0),
    partial.panZ ?? (preservePanAndDistance ? panZ : 0),
    partial.distance ?? (preservePanAndDistance ? distance : targetDistance)
  ];
}
