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

const POSITION_STYLES: Record<CompassNavigationPosition, React.CSSProperties> = {
  'top-left': { top: '16px', left: '16px' },
  'top-right': { top: '16px', right: '16px' },
  'bottom-left': { bottom: '16px', left: '16px' },
  'bottom-right': { bottom: '16px', right: '16px' }
};

const DEFAULT_TRACKBALL_STATE: TrackballState = [35, 15, 0, 0, 0, 2.5];

const DEFAULT_BUTTON_STYLE: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.45)',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  borderRadius: '4px',
  color: '#FFFFFF',
  cursor: 'pointer',
  fontSize: '12px',
  lineHeight: 1.2,
  padding: '4px 8px',
  minWidth: '44px'
};

const DEFAULT_CANVAS_WRAPPER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px'
};

const DEFAULT_PANEL_STYLE: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.55)',
  borderRadius: '8px',
  padding: '12px',
  color: '#FFFFFF',
  minWidth: '140px',
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)'
};

export type CompassNavigationPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

type TrackballState = [number, number, number, number, number, number];

type PartialTrackballState = {
  phi?: number;
  theta?: number;
  panX?: number;
  panY?: number;
  panZ?: number;
  distance?: number;
};

export type CompassNavigationProps = {
  className?: string;
  style?: React.CSSProperties;
  position?: CompassNavigationPosition;
  compassSize?: number;
  animationSeconds?: number;
  preservePanAndDistance?: boolean;
  showProjectionToggle?: boolean;
  labels?: {
    north?: string;
    east?: string;
    south?: string;
    west?: string;
    top?: string;
    home?: string;
    projection?: {
      perspective?: string;
      orthographic?: string;
    };
  };
};

export const CompassNavigation: React.FC<CompassNavigationProps> = ({
  className,
  style,
  position = 'top-right',
  compassSize = 96,
  animationSeconds = 0.8,
  preservePanAndDistance = true,
  showProjectionToggle = true,
  labels
}) => {
  const {
    presenter,
    registerTrackballObserver,
    registerSceneObserver,
    registerToolbarAction
  } = useThreeDHopViewer();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTrackballStateRef = useRef<TrackballState>(DEFAULT_TRACKBALL_STATE);
  const [projectionMode, setProjectionMode] = useState<'perspective' | 'orthographic'>('perspective');

  const containerStyle = useMemo<React.CSSProperties>(() => {
    const basePosition = POSITION_STYLES[position] ?? POSITION_STYLES['top-right'];
    return {
      position: 'absolute',
      pointerEvents: 'auto',
      ...basePosition,
      ...style
    };
  }, [position, style]);

  const ensureCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio ?? 1;
    const desiredWidth = compassSize * dpr;
    const desiredHeight = compassSize * dpr;

    if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
      canvas.width = desiredWidth;
      canvas.height = desiredHeight;
    }

    canvas.style.width = `${compassSize}px`;
    canvas.style.height = `${compassSize}px`;
  }, [compassSize]);

  const drawCompass = useCallback((phiDeg: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ensureCanvasDimensions();
    const context = canvas.getContext('2d');
    if (!context) return;

    const width = canvas.width;
    const height = canvas.height;
    const radius = Math.min(width, height) * 0.45;

    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate((phiDeg * Math.PI) / 180);

    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2, false);
    context.lineWidth = Math.max(2, radius * 0.04);
    context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    context.stroke();

    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, -radius * 1.05);
    context.lineWidth = Math.max(4, radius * 0.18);
    context.lineCap = 'round';
    context.strokeStyle = '#FFC20A';
    context.stroke();

    const tickLength = radius * 0.2;
    const tickWidth = Math.max(2, radius * 0.06);
    context.lineWidth = tickWidth;
    context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    context.beginPath();
    context.moveTo(-tickLength, 0);
    context.lineTo(-radius * 1.1, 0);
    context.stroke();
    context.beginPath();
    context.moveTo(tickLength, 0);
    context.lineTo(radius * 1.1, 0);
    context.stroke();

    context.beginPath();
    context.moveTo(0, radius * 0.6);
    context.lineTo(0, radius * 1.05);
    context.stroke();

    context.beginPath();
    context.arc(0, 0, radius * 0.35, 0, Math.PI * 2, false);
    context.fillStyle = 'rgba(255, 255, 255, 0.85)';
    context.fill();
    context.restore();
  }, [ensureCanvasDimensions]);

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

  const handleTrackballUpdate = useCallback<TrackballObserver>((trackState) => {
    const next = updateTrackballState(trackState);
    drawCompass(next[0]);
  }, [drawCompass, updateTrackballState]);

  useEffect(() => registerTrackballObserver(handleTrackballUpdate), [registerTrackballObserver, handleTrackballUpdate]);

  useEffect(() => registerSceneObserver((instance) => {
    const state = instance.getTrackballPosition?.();
    const next = updateTrackballState(state);
    drawCompass(next[0]);
  }), [registerSceneObserver, updateTrackballState, drawCompass]);

  useEffect(() => {
    if (!presenter) {
      drawCompass(lastTrackballStateRef.current[0]);
      return;
    }
    const state = presenter.getTrackballPosition?.();
    const next = updateTrackballState(state);
    drawCompass(next[0]);
  }, [presenter, updateTrackballState, drawCompass]);

  useEffect(() => registerToolbarAction(['perspective', 'orthographic'], () => {
    setProjectionMode((mode) => (mode === 'perspective' ? 'orthographic' : 'perspective'));
    return false;
  }), [registerToolbarAction]);

  const getCurrentTrackballState = useCallback((): TrackballState => {
    const state = presenter?.getTrackballPosition?.();
    return updateTrackballState(state);
  }, [presenter, updateTrackballState]);

  const animateToPartial = useCallback((partial: PartialTrackballState) => {
    if (!presenter?.animateToTrackballPosition) {
      return;
    }

    const [phi, theta, panX, panY, panZ, distance] = getCurrentTrackballState();
    const next: TrackballState = [
      partial.phi ?? phi,
      partial.theta ?? theta,
      partial.panX ?? (preservePanAndDistance ? panX : 0),
      partial.panY ?? (preservePanAndDistance ? panY : 0),
      partial.panZ ?? (preservePanAndDistance ? panZ : 0),
      partial.distance ?? (preservePanAndDistance ? distance : DEFAULT_TRACKBALL_STATE[5])
    ];

    const duration = Number.isFinite(animationSeconds) && animationSeconds > 0 ? animationSeconds : undefined;
    presenter.animateToTrackballPosition(next, duration);
    lastTrackballStateRef.current = next;
    drawCompass(next[0]);
  }, [presenter, getCurrentTrackballState, preservePanAndDistance, animationSeconds, drawCompass]);

  const handleNorth = useCallback(() => animateToPartial({ phi: 0, theta: 0 }), [animateToPartial]);
  const handleSouth = useCallback(() => animateToPartial({ phi: 180, theta: 0 }), [animateToPartial]);
  const handleEast = useCallback(() => animateToPartial({ phi: -90, theta: 0 }), [animateToPartial]);
  const handleWest = useCallback(() => animateToPartial({ phi: 90, theta: 0 }), [animateToPartial]);
  const handleTop = useCallback(() => animateToPartial({ theta: 90 }), [animateToPartial]);

  const handleResetView = useCallback(() => {
    if (!presenter) {
      return;
    }
    presenter.resetTrackball();
    const state = presenter.getTrackballPosition?.();
    const next = updateTrackballState(state);
    drawCompass(next[0]);
  }, [presenter, updateTrackballState, drawCompass]);

  const handleToggleProjection = useCallback(() => {
    if (!presenter?.toggleCameraType) {
      return;
    }
    presenter.toggleCameraType();
    window.cameraSwitch?.();
    setProjectionMode((mode) => (mode === 'perspective' ? 'orthographic' : 'perspective'));
  }, [presenter]);

  const northLabel = labels?.north ?? 'North';
  const southLabel = labels?.south ?? 'South';
  const eastLabel = labels?.east ?? 'East';
  const westLabel = labels?.west ?? 'West';
  const topLabel = labels?.top ?? 'Top';
  const homeLabel = labels?.home ?? 'Home';
  const perspectiveLabel = labels?.projection?.perspective ?? 'Perspective';
  const orthographicLabel = labels?.projection?.orthographic ?? 'Orthographic';

  const containerClassName = ['compass-navigation', 'hud', className].filter(Boolean).join(' ');
  const panelClassName = ['compass-navigation-panel', 'panel'].join(' ');

  return (
    <div
      className={containerClassName}
      style={containerStyle}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={panelClassName} style={DEFAULT_PANEL_STYLE}>
        <div className="compass-navigation-grid" style={{ display: 'grid', gap: '8px', justifyItems: 'center' }}>
          <button type="button" onClick={handleNorth} title={northLabel} aria-label={northLabel} style={DEFAULT_BUTTON_STYLE}>
            {northLabel}
          </button>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
            <button type="button" onClick={handleEast} title={eastLabel} aria-label={eastLabel} style={DEFAULT_BUTTON_STYLE}>
              {eastLabel}
            </button>
            <div style={DEFAULT_CANVAS_WRAPPER_STYLE}>
              <canvas
                ref={canvasRef}
                role="presentation"
                style={{ cursor: 'pointer' }}
                onClick={handleTop}
                aria-label={topLabel}
              />
            </div>
            <button type="button" onClick={handleWest} title={westLabel} aria-label={westLabel} style={DEFAULT_BUTTON_STYLE}>
              {westLabel}
            </button>
          </div>
          <button type="button" onClick={handleSouth} title={southLabel} aria-label={southLabel} style={DEFAULT_BUTTON_STYLE}>
            {southLabel}
          </button>
        </div>
        <div className="compass-navigation-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
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
