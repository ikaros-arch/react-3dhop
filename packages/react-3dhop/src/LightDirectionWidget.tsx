/**
 * A small draggable disc that sets the scene light direction — a React port of the BITFROST
 * "light controller". Complements `LightControl` (drag-on-canvas mode): this one is always
 * available and shows the current direction, including changes made via the canvas or `Home`.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLightDirection } from './hooks/useLightDirection.js';
import { discToPixel, discToRotateLightArgs, lightDirectionToDisc, pixelToDisc, type DiscPoint } from './geometry/light.js';
import { readThemeToken, themeVar } from './theme.js';

export type LightDirectionWidgetPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const POSITION_STYLES: Record<LightDirectionWidgetPosition, React.CSSProperties> = {
  'top-left': { top: '16px', left: '16px' },
  'top-right': { top: '16px', right: '16px' },
  'bottom-left': { bottom: '16px', left: '16px' },
  'bottom-right': { bottom: '16px', right: '16px' }
};

export type LightDirectionWidgetProps = {
  className?: string;
  style?: React.CSSProperties;
  /** Corner of the viewer; omit to position it yourself via `style`. */
  position?: LightDirectionWidgetPosition;
  /** Canvas size in px (default 126, as in BITFROST). */
  size?: number;
  /** Optional caption rendered under the disc. */
  label?: React.ReactNode;
  title?: string;
  /** Called with the new disc point after every change made through the widget. */
  onChange?: (point: DiscPoint) => void;
};

export const LightDirectionWidget: React.FC<LightDirectionWidgetProps> = ({
  className,
  style,
  position,
  size = 126,
  label,
  title = 'Drag to move the light',
  onChange
}) => {
  const { direction, setFromDisc } = useLightDirection();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef(false);
  const radius = Math.floor(size / 2) - 3;
  const point = useMemo(() => lightDirectionToDisc(direction), [direction]);

  const draw = useCallback(
    (p: DiscPoint) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const mid = size / 2;
      const [hx, hy] = discToPixel(p, size, radius);
      // The disc is a lit sphere: white at the light, dark at the rim (BITFROST's palette).
      const rim = '#212529';
      const outline = readThemeToken(canvas, 'overlayBorder') || 'rgba(0, 0, 0, 0.6)';

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.arc(mid, mid, radius, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(hx, hy, 5, mid, mid, radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, rim);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = outline;
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(hx - 3, hy - 3, 6, 6);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    },
    [radius, size]
  );

  useEffect(() => {
    draw(point);
  }, [draw, point]);

  const applyPointer = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): boolean => {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      const rect = canvas.getBoundingClientRect();
      const scale = rect.width > 0 ? size / rect.width : 1;
      const p = pixelToDisc((event.clientX - rect.left) * scale, (event.clientY - rect.top) * scale, size, radius);
      if (!p) return false;
      const [x, y] = discToRotateLightArgs(p);
      setFromDisc(x, y);
      draw(p); // immediate feedback; the light observer will confirm shortly after
      onChange?.(p);
      return true;
    },
    [draw, onChange, radius, setFromDisc, size]
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!applyPointer(event)) return;
      draggingRef.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [applyPointer]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!draggingRef.current) return;
      applyPointer(event);
    },
    [applyPointer]
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  const containerStyle: React.CSSProperties = {
    ...(position
      ? { position: 'absolute', pointerEvents: 'auto', ...POSITION_STYLES[position] }
      : { pointerEvents: 'auto' }),
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 8,
    background: themeVar('overlayBgStrong'),
    color: themeVar('overlayText'),
    boxShadow: themeVar('overlayShadow'),
    userSelect: 'none',
    touchAction: 'none',
    ...style
  };

  return (
    <div className={className} style={containerStyle} data-hop-light-widget="true">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        role="slider"
        aria-label={title}
        aria-valuetext={`x ${point[0].toFixed(2)}, y ${point[1].toFixed(2)}`}
        title={title}
        style={{ cursor: 'crosshair', display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseDown={(event) => event.stopPropagation()}
      />
      {label ? <div style={{ fontSize: 12 }}>{label}</div> : null}
    </div>
  );
};
