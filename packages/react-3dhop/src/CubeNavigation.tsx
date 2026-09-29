/**
 * Implements a 3D cube navigation HUD that mirrors the presenter's trackball state and
 * offers quick view presets, projection toggles, and directional nudge controls.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  useThreeDHopViewer,
  type TrackballObserver
} from './ThreeDHopViewer.js';
import { themeVar } from './theme.js';
import {
  VIEW_PRESETS,
  clampTheta,
  normalizeAngle,
  type PartialTrackballState,
  type TrackballState
} from './geometry/presets.js';

export type CubeNavigationPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type CubeNavigationProps = {
  className?: string;
  style?: React.CSSProperties;
  position?: CubeNavigationPosition;
  cubeSize?: number;
  animationSeconds?: number;
  preservePanAndDistance?: boolean;
  targetDistance?: number;
  showProjectionToggle?: boolean;
  labels?: {
    front?: string;
    back?: string;
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
    home?: string;
    projection?: {
      perspective?: string;
      orthographic?: string;
    };
  };
  edgeLabels?: {
    up?: string;
    down?: string;
    left?: string;
    right?: string;
  };
};

const POSITION_STYLES: Record<CubeNavigationPosition, React.CSSProperties> = {
  'top-left': { top: '16px', left: '16px' },
  'top-right': { top: '16px', right: '16px' },
  'bottom-left': { bottom: '16px', left: '16px' },
  'bottom-right': { bottom: '16px', right: '16px' }
};

const DEFAULT_TRACKBALL_STATE: TrackballState = [35, 15, 0, 0, 0, 2.5];

const DEFAULT_BUTTON_STYLE: React.CSSProperties = {
  background: themeVar('overlayBg'),
  border: `1px solid ${themeVar('overlayBorder')}`,
  borderRadius: '4px',
  color: themeVar('overlayText'),
  cursor: 'pointer',
  fontSize: '12px',
  lineHeight: 1.2,
  padding: '4px 8px',
  minWidth: '44px'
};

const DEFAULT_PANEL_STYLE: React.CSSProperties = {
  background: themeVar('overlayBgStrong'),
  borderRadius: '8px',
  padding: '12px',
  color: themeVar('overlayText'),
  minWidth: '140px',
  boxShadow: themeVar('overlayShadow')
};

const FACE_VIEW_TARGETS: Record<string, PartialTrackballState> = VIEW_PRESETS;

type EdgeKey = 'top' | 'bottom' | 'left' | 'right';

const EDGE_POSITIONS: Record<EdgeKey, React.CSSProperties> = {
  top: { top: '0%', left: '20%', right: '20%', height: '20%' },
  bottom: { bottom: '0%', left: '20%', right: '20%', height: '20%' },
  left: { left: '0%', top: '20%', bottom: '20%', width: '20%' },
  right: { right: '0%', top: '20%', bottom: '20%', width: '20%' }
};

const EDGE_ORDER: EdgeKey[] = ['top', 'right', 'bottom', 'left'];

/**
 * HUD overlay that animates the presenter to known cube faces and edges while tracking
 * live orientation updates from the 3DHOP trackball.
 */
export const CubeNavigation: React.FC<CubeNavigationProps> = ({
  className,
  style,
  position = 'top-right',
  cubeSize = 128,
  animationSeconds = 0.8,
  preservePanAndDistance = true,
  targetDistance = 1.3,
  showProjectionToggle = true,
  labels,
  edgeLabels
}) => {
  const {
    presenter,
    registerTrackballObserver,
    registerSceneObserver,
    registerToolbarAction
  } = useThreeDHopViewer();
  const containerStyle = useMemo<React.CSSProperties>(() => {
    const basePosition = POSITION_STYLES[position] ?? POSITION_STYLES['top-right'];
    return {
      position: 'absolute',
      pointerEvents: 'auto',
      ...basePosition,
      ...style
    };
  }, [position, style]);

  const [projectionMode, setProjectionMode] = useState<'perspective' | 'orthographic'>('perspective');
  const [rotation, setRotation] = useState<{ x: number; y: number }>({ x: -DEFAULT_TRACKBALL_STATE[1], y: -DEFAULT_TRACKBALL_STATE[0] });
  const lastTrackballStateRef = useRef<TrackballState>(DEFAULT_TRACKBALL_STATE);

  /**
   * Normalizes incoming trackball arrays into a stable six-value tuple and caches the
   * latest state for reuse across animations.
   */
  const updateTrackballState = useCallback((state: number[] | null | undefined) => {
    const current = lastTrackballStateRef.current;
    if (!Array.isArray(state) || state.length === 0) {
      return current;
    }

    const next: TrackballState = [...current];
    const limit = Math.min(state.length, 6);
    for (let index = 0; index < limit; index += 1) {
      const value = Number(state[index]);
      if (Number.isFinite(value)) {
        next[index] = value;
      }
    }
    lastTrackballStateRef.current = next;
    return next;
  }, []);

  /**
   * Projects the trackball's phi/theta values onto the cube representation so the HUD
   * matches the presenter's camera orientation.
   */
  const applyRotationFromTrackball = useCallback((state: TrackballState) => {
    setRotation({ x: -state[1], y: -state[0] });
  }, []);

  /**
   * Processes presenter trackball events and updates the cube rotation in response.
   */
  const handleTrackballUpdate = useCallback<TrackballObserver>((trackState) => {
    const next = updateTrackballState(trackState);
    applyRotationFromTrackball(next);
  }, [updateTrackballState, applyRotationFromTrackball]);

  useEffect(() => registerTrackballObserver(handleTrackballUpdate), [registerTrackballObserver, handleTrackballUpdate]);

  useEffect(() => registerSceneObserver((instance) => {
    const state = instance.getTrackballPosition?.();
    const next = updateTrackballState(state);
    applyRotationFromTrackball(next);
  }), [registerSceneObserver, updateTrackballState, applyRotationFromTrackball]);

  useEffect(() => {
    if (!presenter) {
      applyRotationFromTrackball(lastTrackballStateRef.current);
      return;
    }
    const state = presenter.getTrackballPosition?.();
    const next = updateTrackballState(state);
    applyRotationFromTrackball(next);
  }, [presenter, updateTrackballState, applyRotationFromTrackball]);

  useEffect(() => registerToolbarAction(['perspective', 'orthographic'], () => {
    setProjectionMode((mode) => (mode === 'perspective' ? 'orthographic' : 'perspective'));
    return false;
  }), [registerToolbarAction]);

  /**
   * Reads the presenter's current trackball state, falling back to the cached values when
   * the presenter is unavailable (SSR or before mount).
   */
  const getCurrentTrackballState = useCallback((): TrackballState => {
    const state = presenter?.getTrackballPosition?.();
    return updateTrackballState(state);
  }, [presenter, updateTrackballState]);

  /**
   * Builds a full trackball vector from the supplied partial overrides and animates the
   * presenter while respecting optional pan/distance preservation.
   */
  const animateToPartial = useCallback((partial: PartialTrackballState) => {
    if (!presenter?.animateToTrackballPosition) {
      return;
    }

    const [phi, theta, panX, panY, panZ, distance] = getCurrentTrackballState();
    const next: TrackballState = [
      normalizeAngle(partial.phi ?? phi),
      clampTheta(partial.theta ?? theta),
      partial.panX ?? (preservePanAndDistance ? panX : 0),
      partial.panY ?? (preservePanAndDistance ? panY : 0),
      partial.panZ ?? (preservePanAndDistance ? panZ : 0),
      partial.distance ?? (preservePanAndDistance ? distance : targetDistance)
    ];

    const duration = Number.isFinite(animationSeconds) && animationSeconds > 0 ? animationSeconds : undefined;
    presenter.animateToTrackballPosition(next, duration);
    lastTrackballStateRef.current = next;
    applyRotationFromTrackball(next);
  }, [presenter, getCurrentTrackballState, preservePanAndDistance, targetDistance, animationSeconds, applyRotationFromTrackball]);

  /**
   * Animates the camera so the chosen cube face becomes front-facing.
   */
  const handleFaceSelection = useCallback((face: keyof typeof FACE_VIEW_TARGETS) => {
    const partial = FACE_VIEW_TARGETS[face];
    if (!partial) return;
    animateToPartial(partial);
  }, [animateToPartial]);

  /**
   * Rotates around the cube by delta increments, convenient for edge buttons.
   */
  const animateByDelta = useCallback((deltaPhi: number, deltaTheta: number) => {
    if (!presenter?.animateToTrackballPosition) {
      return;
    }

    const [phi, theta, panX, panY, panZ, distance] = getCurrentTrackballState();
    const target: PartialTrackballState = {
      phi: normalizeAngle(phi + deltaPhi),
      theta: clampTheta(theta + deltaTheta),
      panX: preservePanAndDistance ? panX : 0,
      panY: preservePanAndDistance ? panY : 0,
      panZ: preservePanAndDistance ? panZ : 0,
      distance: preservePanAndDistance ? distance : targetDistance
    };

    animateToPartial(target);
  }, [presenter, getCurrentTrackballState, preservePanAndDistance, targetDistance, animateToPartial]);

  /**
   * Maps edge button presses to the corresponding rotational deltas.
   */
  const handleEdgeSelection = useCallback((edge: EdgeKey) => {
    switch (edge) {
      case 'top':
        animateByDelta(0, 90);
        break;
      case 'bottom':
        animateByDelta(0, -90);
        break;
      case 'left':
        animateByDelta(-90, 0);
        break;
      case 'right':
        animateByDelta(90, 0);
        break;
      default:
        break;
    }
  }, [animateByDelta]);

  /**
   * Resets the presenter camera and syncs the cube orientation to match.
   */
  const handleResetView = useCallback(() => {
    if (!presenter) {
      return;
    }
    presenter.resetTrackball();
    const state = presenter.getTrackballPosition?.();
    const next = updateTrackballState(state);
    applyRotationFromTrackball(next);
  }, [presenter, updateTrackballState, applyRotationFromTrackball]);

  /**
   * Toggles between perspective and orthographic cameras and updates the HUD label.
   */
  const handleToggleProjection = useCallback(() => {
    if (!presenter?.toggleCameraType) {
      return;
    }
    presenter.toggleCameraType();
    window.cameraSwitch?.();
    setProjectionMode((mode) => (mode === 'perspective' ? 'orthographic' : 'perspective'));
  }, [presenter]);

  const frontLabel = labels?.front ?? 'Front';
  const backLabel = labels?.back ?? 'Back';
  const leftLabel = labels?.left ?? 'Left';
  const rightLabel = labels?.right ?? 'Right';
  const topLabel = labels?.top ?? 'Top';
  const bottomLabel = labels?.bottom ?? 'Bottom';
  const homeLabel = labels?.home ?? 'Home';
  const perspectiveLabel = labels?.projection?.perspective ?? 'Perspective';
  const orthographicLabel = labels?.projection?.orthographic ?? 'Orthographic';

  const edgeUpLabel = edgeLabels?.up ?? '^';
  const edgeDownLabel = edgeLabels?.down ?? 'v';
  const edgeLeftLabel = edgeLabels?.left ?? '<';
  const edgeRightLabel = edgeLabels?.right ?? '>';

  const perspectiveValue = cubeSize * 3.5;
  const halfSize = cubeSize / 2;

  const cubeSceneStyle: React.CSSProperties = {
    width: `${cubeSize}px`,
    height: `${cubeSize}px`,
    perspective: `${perspectiveValue}px`,
    position: 'relative'
  };

  const cubeTransform = `translateZ(-${halfSize}px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`;

  const cubeStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'absolute',
    transformStyle: 'preserve-3d',
    transform: cubeTransform,
    transition: 'transform 0.3s ease-out'
  };

  const faceBaseStyle: React.CSSProperties = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    background: themeVar('controlBg'),
    border: `1px solid ${themeVar('controlBorder')}`,
    boxSizing: 'border-box',
    color: themeVar('overlayText'),
    cursor: 'pointer',
    userSelect: 'none',
    transformStyle: 'preserve-3d'
  };

  const faceLabelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '32%',
    left: '16%',
    right: '16%',
    bottom: '32%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    letterSpacing: '0.08em',
    pointerEvents: 'none'
  };

  const faceEdgeStyle: React.CSSProperties = {
    position: 'absolute',
    background: themeVar('overlayBg', 'rgba(0, 0, 0, 0.25)'),
    border: 'none',
    color: themeVar('overlayText'),
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
    outline: 'none',
    transition: 'background 0.15s ease',
    zIndex: 2
  };

  const faces: Array<{ key: keyof typeof FACE_VIEW_TARGETS; label: string; transform: string }> = [
    { key: 'front', label: frontLabel, transform: `rotateY(0deg) translateZ(${halfSize}px)` },
    { key: 'back', label: backLabel, transform: `rotateY(180deg) translateZ(${halfSize}px)` },
    { key: 'right', label: rightLabel, transform: `rotateY(90deg) translateZ(${halfSize}px)` },
    { key: 'left', label: leftLabel, transform: `rotateY(-90deg) translateZ(${halfSize}px)` },
    { key: 'top', label: topLabel, transform: `rotateX(90deg) translateZ(${halfSize}px)` },
    { key: 'bottom', label: bottomLabel, transform: `rotateX(-90deg) translateZ(${halfSize}px)` }
  ];

  const containerClassName = ['cube-navigation', 'hud', className].filter(Boolean).join(' ');
  const panelClassName = ['cube-navigation-panel', 'panel'].join(' ');

  return (
    <div
      className={containerClassName}
      style={containerStyle}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={panelClassName} style={DEFAULT_PANEL_STYLE}>
        <div className="cube-navigation-scene" style={cubeSceneStyle}>
          <div className="cube-navigation-cube" style={cubeStyle}>
            {faces.map((face) => (
              <div
                key={face.key}
                className={`cube-navigation-face cube-navigation-face-${face.key}`}
                style={{ ...faceBaseStyle, transform: face.transform }}
                onClick={(event) => {
                  event.stopPropagation();
                  handleFaceSelection(face.key);
                }}
                onMouseDown={(event) => event.stopPropagation()}
                aria-label={face.label}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleFaceSelection(face.key);
                  }
                }}
              >
                <div style={faceLabelStyle}>{face.label}</div>
                {EDGE_ORDER.map((edge) => {
                  const labelByEdge = edge === 'top'
                    ? edgeUpLabel
                    : edge === 'bottom'
                      ? edgeDownLabel
                      : edge === 'left'
                        ? edgeLeftLabel
                        : edgeRightLabel;

                  return (
                    <button
                      key={edge}
                      type="button"
                      className={`cube-navigation-face-edge cube-navigation-face-edge-${edge}`}
                      style={{ ...faceEdgeStyle, ...EDGE_POSITIONS[edge] }}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEdgeSelection(edge);
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleEdgeSelection(edge);
                        }
                      }}
                    >
                      {labelByEdge}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="cube-navigation-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
          <button type="button" onClick={handleResetView} title={homeLabel} aria-label={homeLabel} style={DEFAULT_BUTTON_STYLE}>
            {homeLabel}
          </button>
          {showProjectionToggle ? (
            <button
              type="button"
              onClick={handleToggleProjection}
              title={projectionMode === 'perspective' ? orthographicLabel : perspectiveLabel}
              aria-label={projectionMode === 'perspective' ? orthographicLabel : perspectiveLabel}
              style={DEFAULT_BUTTON_STYLE}
            >
              {projectionMode === 'perspective' ? orthographicLabel : perspectiveLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
