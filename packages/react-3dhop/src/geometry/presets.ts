/**
 * Named camera orientations for 3DHOP's turntable trackballs, shared by `CubeNavigation`,
 * `ViewPresetButtons` and `useViewPresets`.
 *
 * 3DHOP ships two turntables with different state shapes: `TurnTableTrackball` reports
 * `[phi, theta, distance]`, `TurnTablePanTrackball` reports `[phi, theta, panX, panY, panZ,
 * distance]`. The helpers below work on the six-value form internally and convert back to whatever
 * the presenter reported, so `distance` never lands in a pan slot.
 */

/** `[phi, theta, panX, panY, panZ, distance]` — the six-value (pan turntable) form. */
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

/**
 * Coerces whatever the presenter returns into the six-value form, filling gaps from `fallback`.
 * A three-value `[phi, theta, distance]` state is widened with zero pan.
 */
export function toTrackballState(state: readonly number[] | null | undefined, fallback: TrackballState): TrackballState {
  const next: TrackballState = [...fallback];
  if (!Array.isArray(state)) return next;
  const source = state.length === 3 ? [state[0], state[1], 0, 0, 0, state[2]] : state;
  for (let i = 0; i < Math.min(source.length, 6); i++) {
    const v = Number(source[i]);
    if (Number.isFinite(v)) next[i] = v;
  }
  return next;
}

/**
 * Converts a six-value state back to the shape the presenter reported: three values for the plain
 * turntable, six for the pan turntable (default when the shape is unknown).
 */
export function toPresenterTrackballState(state: TrackballState, reported: readonly number[] | null | undefined): number[] {
  if (Array.isArray(reported) && reported.length === 3) {
    return [state[0], state[1], state[5]];
  }
  return [...state];
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
