import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ToggleImagePair,
  resolveToggleIcon,
  useToolbarAssets,
  useToolbarSidecar,
  type ToggleIcons,
  type ToggleImgProps,
  type ToggleLabels
} from './Toolbar.js';
import { useThreeDHopViewer } from './viewer/context.js';
import { useSceneBounds } from './hooks/useSceneBounds.js';
import { useSceneEntity } from './hooks/useSceneEntity.js';
import {
  GRID_MODES,
  buildAxes,
  buildBoxGrid,
  buildFixedGrid,
  buildFlatGrid,
  gridStepForUnit,
  type GridMode
} from './geometry/grid.js';
import { themeVar } from './theme.js';
import type { Vector3 } from './viewer/types.js';

export type { GridMode };

export type GridOverlayProps = {
  /** Which grid to draw; `'off'` draws nothing. */
  mode: GridMode;
  /**
   * Grid cell size in model units. Defaults to a 1 cm cell derived from the viewer's
   * `measurementUnits` (see `gridStepForUnit`).
   */
  step?: number;
  /** Origin of the axes in `'axes'` mode: the scene's bounds centre (default) or the world origin. */
  axesOrigin?: 'center' | 'world' | Vector3;
};

/**
 * Headless helper geometry: draws a floor grid, a bounding-box grid, a fixed world-plane grid or
 * XYZ axes over the scene, kept alive across scene rebuilds. Use `GridControl` for the toolbar
 * toggle, or drive this directly for programmatic control. Ported from the BITFROST viewer.
 */
export const GridOverlay: React.FC<GridOverlayProps> = ({ mode, step, axesOrigin = 'center' }) => {
  const { measurementUnits } = useThreeDHopViewer();
  const { bounds } = useSceneBounds();
  const resolvedStep = step ?? gridStepForUnit(measurementUnits);
  const originKey = Array.isArray(axesOrigin) ? axesOrigin.join(',') : axesOrigin;

  const origin = useMemo<Vector3 | undefined>(() => {
    if (Array.isArray(axesOrigin)) return axesOrigin;
    if (axesOrigin === 'world') return [0, 0, 0];
    return undefined; // bounds centre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originKey]);

  const deps = [mode, resolvedStep, bounds, origin];
  useSceneEntity('r3dhop-grid-flat', () => (mode === 'flat' && bounds ? buildFlatGrid(bounds, resolvedStep) : null), deps);
  useSceneEntity('r3dhop-grid-box', () => (mode === 'box' && bounds ? buildBoxGrid(bounds, resolvedStep) : null), deps);
  useSceneEntity('r3dhop-grid-fixed', () => (mode === 'fixed' && bounds ? buildFixedGrid(bounds, resolvedStep) : null), deps);
  useSceneEntity('r3dhop-axis-x', () => (mode === 'axes' && bounds ? buildAxes(bounds, origin).x : null), deps);
  useSceneEntity('r3dhop-axis-y', () => (mode === 'axes' && bounds ? buildAxes(bounds, origin).y : null), deps);
  useSceneEntity('r3dhop-axis-z', () => (mode === 'axes' && bounds ? buildAxes(bounds, origin).z : null), deps);

  return null;
};

export const GRID_MODE_LABELS: Record<Exclude<GridMode, 'off'>, string> = {
  flat: 'Floor',
  box: 'Box',
  fixed: 'Fixed',
  axes: 'Axes'
};

export type GridControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
  /** Controlled mode. */
  mode?: GridMode;
  /** Initial mode when uncontrolled (default `'off'`). */
  defaultMode?: GridMode;
  onModeChange?: (mode: GridMode) => void;
  /** Mode chosen when the toolbar icon switches the grid on (default `'flat'`). */
  defaultOnMode?: Exclude<GridMode, 'off'>;
  /** Restrict the modes offered in the sidecar (default: all). */
  modes?: readonly Exclude<GridMode, 'off'>[];
  /** Hide the mode picker sidecar; the icon then just toggles `defaultOnMode`. */
  showModePicker?: boolean;
  /** Heading shown in the sidecar. */
  label?: string;
  /** Passed through to the overlay. */
  step?: number;
  axesOrigin?: GridOverlayProps['axesOrigin'];
} & ToggleImgProps;

/**
 * Toolbar toggle for the grid overlay. Clicking the icon switches the last-used grid on or off;
 * while on, a sidecar offers the grid modes (floor / box / fixed / axes). Renders its own
 * `GridOverlay`, so don't mount both. Works controlled (`mode` + `onModeChange`) or uncontrolled.
 */
export const GridControl: React.FC<GridControlProps> = ({
  title,
  icon,
  mode: controlledMode,
  defaultMode = 'off',
  onModeChange,
  defaultOnMode = 'flat',
  modes,
  showModePicker = true,
  label,
  step,
  axesOrigin,
  enabledImgProps,
  disabledImgProps
}) => {
  const { assetBaseUrl } = useToolbarAssets();
  const { registerToolbarAction } = useThreeDHopViewer();
  const [internalMode, setInternalMode] = useState<GridMode>(defaultMode);
  const mode = controlledMode ?? internalMode;
  const lastOnModeRef = useRef<Exclude<GridMode, 'off'>>(mode !== 'off' ? mode : defaultOnMode);
  if (mode !== 'off') lastOnModeRef.current = mode;

  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const setMode = useCallback(
    (next: GridMode) => {
      if (controlledMode === undefined) setInternalMode(next);
      onModeChangeRef.current?.(next);
    },
    [controlledMode]
  );

  useEffect(
    () =>
      registerToolbarAction(['grid', 'grid_on'], () => {
        setMode(modeRef.current === 'off' ? lastOnModeRef.current : 'off');
        return true;
      }),
    [registerToolbarAction, setMode]
  );

  const isOn = mode !== 'off';
  const enabledTitle = title?.enabled ?? 'Hide Grid';
  const disabledTitle = title?.disabled ?? 'Show Grid';
  const enabledIcon = resolveToggleIcon(assetBaseUrl, icon?.enabled, 'skins/dark/grid_on.svg');
  const disabledIcon = resolveToggleIcon(assetBaseUrl, icon?.disabled, 'skins/dark/grid.svg');
  const offeredModes = modes ?? (GRID_MODES.filter((m) => m !== 'off') as Exclude<GridMode, 'off'>[]);

  useToolbarSidecar(
    'grid-box',
    showModePicker ? (
      <div
        id="grid-box"
        data-hop-sidecar="grid-box"
        data-hop-anchor="grid,grid_on"
        className="output-box"
        role="group"
        aria-label={label ?? 'Grid mode'}
        style={{ pointerEvents: 'auto', display: isOn ? 'table' : 'none' }}
      >
        {label ?? 'Grid'}
        <hr />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onMouseDown={(e) => e.stopPropagation()}>
          {offeredModes.map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                data-hop-grid-mode={m}
                onClick={() => setMode(m)}
                style={{
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: `1px solid ${themeVar('controlBorder')}`,
                  background: active ? themeVar('accent') : themeVar('controlBg'),
                  color: active ? themeVar('ink') : 'inherit',
                  font: 'inherit'
                }}
              >
                {GRID_MODE_LABELS[m]}
              </button>
            );
          })}
        </div>
      </div>
    ) : null
  );

  return (
    <>
      <GridOverlay mode={mode} step={step} axesOrigin={axesOrigin} />
      <ToggleImagePair
        primary={{ id: 'grid_on', title: enabledTitle, src: enabledIcon, imgProps: enabledImgProps, hidden: !isOn }}
        secondary={{ id: 'grid', title: disabledTitle, src: disabledIcon, imgProps: disabledImgProps, hidden: isOn }}
      />
    </>
  );
};
