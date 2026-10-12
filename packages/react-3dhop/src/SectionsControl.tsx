import React, { useCallback, useEffect, useState } from 'react';
import {
  ToggleImagePair,
  resolveControlIcon,
  useToolbarAssets,
  useToolbarSidecar,
  type ToggleIcons,
  type ToggleImgProps,
  type ToggleLabels
} from './Toolbar.js';
import { useThreeDHopViewer } from './viewer/context.js';
import type { PresenterInstance } from './viewer/types.js';

export type SectionAxis = 'x' | 'y' | 'z';

export type SectionPlaneState = {
  /** Whether this axis's clipping plane is active. */
  enabled: boolean;
  /** Plane position along the axis, from 0 (scene bounds min) to 1 (max). */
  position: number;
  /** Clips the opposite half-space. */
  flip: boolean;
};

export type SectionsState = {
  x: SectionPlaneState;
  y: SectionPlaneState;
  z: SectionPlaneState;
  /** Render the clipped cross-section as filled planes. */
  showPlanes: boolean;
  /** Outline the clipped cross-section's edges. */
  showEdges: boolean;
};

const DEFAULT_PLANE: SectionPlaneState = { enabled: false, position: 0.5, flip: false };

export const DEFAULT_SECTIONS_STATE: SectionsState = {
  x: DEFAULT_PLANE,
  y: DEFAULT_PLANE,
  z: DEFAULT_PLANE,
  showPlanes: true,
  showEdges: true
};

/**
 * Pushes `state` onto the live presenter. Closing (`open: false`) zeroes every axis without
 * discarding the stored slider/flip state, matching 3DHOP's own `sectiontoolSwitch(false)`.
 * Guards on `_scene` the same way `useSceneEntity` does - clipping setters call the presenter's
 * `_calculateBounding()`, which assumes a scene already exists.
 */
function applySectionsState(presenter: PresenterInstance, state: SectionsState, open: boolean): void {
  if (!presenter._scene) return;

  if (!open) {
    presenter.setClippingXYZ?.(0, 0, 0);
    return;
  }

  presenter.setClippingPointXYZ?.(state.x.position, state.y.position, state.z.position);
  presenter.setClippingX?.(state.x.enabled ? (state.x.flip ? -1 : 1) : 0);
  presenter.setClippingY?.(state.y.enabled ? (state.y.flip ? -1 : 1) : 0);
  presenter.setClippingZ?.(state.z.enabled ? (state.z.flip ? -1 : 1) : 0);
  presenter.setClippingRendermode?.(state.showPlanes, state.showEdges);
}

export type SectionsControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
  axisLabels?: {
    x?: string;
    y?: string;
    z?: string;
  };
  showPlanesLabel?: string;
  showEdgesLabel?: string;
  /** Controlled open/closed. */
  open?: boolean;
  /** Initial open state when uncontrolled (default `false`). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Controlled per-axis and render state. */
  state?: SectionsState;
  /** Initial state when uncontrolled (default: every axis off at the midpoint). */
  defaultState?: SectionsState;
  onStateChange?: (state: SectionsState) => void;
} & ToggleImgProps;

/**
 * Toolbar toggle for 3DHOP's per-axis clipping planes. Calls the presenter's `setClipping*`
 * methods directly from React state - unlike the legacy sidecar, no DOM ids and no dependency
 * on `init.js`'s `sectiontoolInit`/`sectionxSwitch` globals, so multiple viewer instances no
 * longer fight over the same ids. Works controlled (`open`/`state` + their `onChange`s) or
 * uncontrolled.
 */
export const SectionsControl: React.FC<SectionsControlProps> = ({
  title,
  icon,
  axisLabels,
  showPlanesLabel,
  showEdgesLabel,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  state: controlledState,
  defaultState = DEFAULT_SECTIONS_STATE,
  onStateChange,
  enabledImgProps,
  disabledImgProps
}) => {
  const { assetBaseUrl } = useToolbarAssets();
  const { presenter, registerToolbarAction, registerSceneObserver, registerSceneReadyObserver } =
    useThreeDHopViewer();

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const [internalState, setInternalState] = useState<SectionsState>(defaultState);
  const state = controlledState ?? internalState;

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange]
  );

  const setSectionsState = useCallback(
    (next: SectionsState) => {
      if (controlledState === undefined) setInternalState(next);
      onStateChange?.(next);
    },
    [controlledState, onStateChange]
  );

  const setAxis = useCallback(
    (axis: SectionAxis, patch: Partial<SectionPlaneState>) => {
      setSectionsState({ ...state, [axis]: { ...state[axis], ...patch } });
    },
    [state, setSectionsState]
  );

  useEffect(
    () =>
      registerToolbarAction(['sections', 'sections_on'], () => {
        setOpen(!open);
        return true;
      }),
    [registerToolbarAction, setOpen, open]
  );

  // Re-applies on mount, whenever state/open changes, and after every scene rebuild (3DHOP
  // carries no clipping state across `setScene`, same as it carries no helper entities).
  useEffect(() => {
    if (!presenter) return;
    const apply = (target: PresenterInstance) => applySectionsState(target, state, open);
    apply(presenter);
    const disposeScene = registerSceneObserver(apply);
    const disposeReady = registerSceneReadyObserver(apply);
    return () => {
      disposeScene();
      disposeReady();
    };
  }, [presenter, state, open, registerSceneObserver, registerSceneReadyObserver]);

  const enabledTitle = title?.enabled ?? 'Disable Plane Sections';
  const disabledTitle = title?.disabled ?? 'Enable Plane Sections';
  const enabledIcon = resolveControlIcon(assetBaseUrl, icon?.enabled, 'skins/dark/sections_on.png');
  const disabledIcon = resolveControlIcon(assetBaseUrl, icon?.disabled, 'skins/dark/sections.png');

  const axisRow = (axis: SectionAxis, fallbackLabel: string) => {
    const plane = state[axis];
    const label = axisLabels?.[axis] ?? fallbackLabel;
    const onIcon = `${assetBaseUrl}/skins/icons/section${axis.toUpperCase()}_on.png`;
    const offIcon = `${assetBaseUrl}/skins/icons/section${axis.toUpperCase()}.png`;

    return (
      <tr key={axis}>
        <td>
          <img
            data-hop-section-axis={axis}
            data-hop-section-enabled={plane.enabled}
            src={plane.enabled ? onIcon : offIcon}
            alt=""
            title={plane.enabled ? `Disable ${label} Section` : `Enable ${label} Section`}
            onClick={() => setAxis(axis, { enabled: !plane.enabled })}
            style={{ cursor: 'pointer' }}
          />
        </td>
        <td>
          <input
            data-hop-section-slider={axis}
            className="output-input"
            type="range"
            min={0}
            max={1}
            step={0.01}
            title={`Move ${label} Section Position`}
            value={plane.position}
            onChange={(event) => setAxis(axis, { enabled: true, position: event.target.valueAsNumber })}
          />
        </td>
        <td>
          <input
            data-hop-section-flip={axis}
            className="output-input"
            type="checkbox"
            title={`Flip ${label} Section Direction`}
            checked={plane.flip}
            onChange={(event) => setAxis(axis, { flip: event.target.checked })}
          />
        </td>
      </tr>
    );
  };

  useToolbarSidecar(
    'sections-box',
    <div
      id="sections-box"
      data-hop-sidecar="sections-box"
      data-hop-anchor="sections,sections_on"
      className="output-box"
      style={{ pointerEvents: 'auto', display: open ? 'table' : 'none' }}
    >
      <table className="output-table" onMouseDown={(event) => event.stopPropagation()}>
        <tbody>
          <tr>
            <td>Plane</td>
            <td>Position</td>
            <td>Flip</td>
          </tr>
          {axisRow('x', 'X Axis')}
          {axisRow('y', 'Y Axis')}
          {axisRow('z', 'Z Axis')}
        </tbody>
      </table>
      <table
        className="output-table"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ textAlign: 'right' }}
      >
        <tbody>
          <tr>
            <td>
              {showPlanesLabel ?? 'Show planes'}
              <input
                data-hop-section-show-planes=""
                className="output-input"
                type="checkbox"
                title="Show Section Planes"
                checked={state.showPlanes}
                onChange={(event) => setSectionsState({ ...state, showPlanes: event.target.checked })}
                style={{ bottom: '-3px' }}
              />
            </td>
            <td>
              {showEdgesLabel ?? 'Show edges'}
              <input
                data-hop-section-show-edges=""
                className="output-input"
                type="checkbox"
                title="Show Section Edges"
                checked={state.showEdges}
                onChange={(event) => setSectionsState({ ...state, showEdges: event.target.checked })}
                style={{ bottom: '-3px' }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <ToggleImagePair
      primary={{ id: 'sections_on', title: enabledTitle, icon: enabledIcon, imgProps: enabledImgProps, hidden: !open }}
      secondary={{ id: 'sections', title: disabledTitle, icon: disabledIcon, imgProps: disabledImgProps, hidden: open }}
    />
  );
};
