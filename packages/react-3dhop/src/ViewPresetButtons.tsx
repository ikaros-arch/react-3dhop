/**
 * A compact row (or column) of buttons that snap the camera to the standard views. A lighter
 * alternative to `CubeNavigation` when you just want "Front / Top / Left…" buttons.
 */
import React, { useMemo } from 'react';
import { useViewPresets, type UseViewPresetsOptions } from './hooks/useViewPresets.js';
import { VIEW_PRESET_LABELS, VIEW_PRESET_ORDER, type ViewPreset } from './geometry/presets.js';
import { themeVar } from './theme.js';

export type ViewPresetButtonsPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const POSITION_STYLES: Record<ViewPresetButtonsPosition, React.CSSProperties> = {
  'top-left': { top: '16px', left: '16px' },
  'top-right': { top: '16px', right: '16px' },
  'bottom-left': { bottom: '16px', left: '16px' },
  'bottom-right': { bottom: '16px', right: '16px' }
};

export type ViewPresetButtonsProps = UseViewPresetsOptions & {
  className?: string;
  style?: React.CSSProperties;
  /** Corner of the viewer; omit to position it yourself via `style`. */
  position?: ViewPresetButtonsPosition;
  /** Which presets to show, in order (default: all six). */
  presets?: readonly ViewPreset[];
  /** Override button captions. */
  labels?: Partial<Record<ViewPreset, string>>;
  direction?: 'row' | 'column';
  /** Called after a preset has been applied. */
  onSelect?: (preset: ViewPreset) => void;
  buttonStyle?: React.CSSProperties;
};

export const ViewPresetButtons: React.FC<ViewPresetButtonsProps> = ({
  className,
  style,
  position,
  presets = VIEW_PRESET_ORDER,
  labels,
  direction = 'row',
  onSelect,
  buttonStyle,
  animationSeconds,
  preservePanAndDistance,
  targetDistance
}) => {
  const { viewFrom } = useViewPresets({ animationSeconds, preservePanAndDistance, targetDistance });

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      ...(position ? { position: 'absolute', ...POSITION_STYLES[position] } : {}),
      pointerEvents: 'auto',
      display: 'inline-flex',
      flexDirection: direction,
      gap: 4,
      padding: 6,
      borderRadius: 8,
      background: themeVar('overlayBgStrong'),
      boxShadow: themeVar('overlayShadow'),
      ...style
    }),
    [direction, position, style]
  );

  const resolvedButtonStyle: React.CSSProperties = {
    background: themeVar('overlayBg'),
    border: `1px solid ${themeVar('overlayBorder')}`,
    borderRadius: 4,
    color: themeVar('overlayText'),
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1.2,
    padding: '4px 8px',
    minWidth: 44,
    ...buttonStyle
  };

  return (
    <div className={className} style={containerStyle} role="group" aria-label="View presets" data-hop-view-presets="true">
      {presets.map((preset) => (
        <button
          key={preset}
          type="button"
          data-hop-view-preset={preset}
          style={resolvedButtonStyle}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            viewFrom(preset);
            onSelect?.(preset);
          }}
        >
          {labels?.[preset] ?? VIEW_PRESET_LABELS[preset]}
        </button>
      ))}
    </div>
  );
};
