import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CopyableOutput,
  ToggleImagePair,
  resolveToggleIcon,
  useToolbarAssets,
  useToolbarSidecar,
  type ToggleIcons,
  type ToggleImgProps,
  type ToggleLabels
} from './Toolbar.js';
import { useThreeDHopViewer } from './viewer/context.js';
import { queryToolbarElements, queryToolbarSidecars } from './viewer/dom.js';
import { useSceneEntity } from './hooks/useSceneEntity.js';
import { angleEntities, computeAngle, formatAngle } from './geometry/angle.js';
import type { InteractiveToolPickContext, Vector3 } from './viewer/types.js';

export const ANGLE_TOOL_ID = 'angle';

export type AngleControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
  /** Heading shown in the sidecar. */
  label?: string;
  /** Decimal places for the displayed angle (default 2). */
  digits?: number;
  /** Text shown before three points have been picked. */
  initialDisplayValue?: string;
  /** Called every time a full angle (three picks) is measured. */
  onAngle?: (degrees: number, points: [Vector3, Vector3, Vector3]) => void;
} & ToggleImgProps;

/**
 * Toolbar toggle for measuring the angle between three picked points on the model. Rides on
 * 3DHOP's pick-point mode, draws the picked points, both arms and a translucent wedge as scene
 * entities, and shows the angle (with copy support) in a toolbar sidecar. Mutually exclusive
 * with the measure and pick tools. Ported from the BITFROST viewer.
 */
export const AngleControl: React.FC<AngleControlProps> = ({
  title,
  icon,
  label,
  digits = 2,
  initialDisplayValue,
  onAngle,
  enabledImgProps,
  disabledImgProps
}) => {
  const { assetBaseUrl } = useToolbarAssets();
  const { registerInteractiveTool, activeInteractiveTool } = useThreeDHopViewer();
  const [points, setPoints] = useState<Vector3[]>([]);
  const pointsRef = useRef<Vector3[]>([]);
  const onAngleRef = useRef(onAngle);
  onAngleRef.current = onAngle;

  const isActive = activeInteractiveTool === ANGLE_TOOL_ID;
  const enabledTitle = title?.enabled ?? 'Disable Angle Tool';
  const disabledTitle = title?.disabled ?? 'Enable Angle Tool';
  const enabledIcon = resolveToggleIcon(assetBaseUrl, icon?.enabled, 'skins/dark/angle_on.png');
  const disabledIcon = resolveToggleIcon(assetBaseUrl, icon?.disabled, 'skins/dark/angle.png');

  const angle = points.length === 3 ? computeAngle(points[0], points[1], points[2]) : null;
  const displayValue = angle != null ? formatAngle(angle, digits) : initialDisplayValue ?? formatAngle(0, digits);

  const resetPoints = useCallback(() => {
    pointsRef.current = [];
    setPoints([]);
  }, []);

  const syncUi = useCallback(
    (enabled?: boolean) => {
      const on = enabled ?? false;
      queryToolbarElements<HTMLImageElement>(ANGLE_TOOL_ID).forEach((el) => {
        el.style.visibility = on ? 'hidden' : 'visible';
      });
      queryToolbarElements<HTMLImageElement>(`${ANGLE_TOOL_ID}_on`).forEach((el) => {
        el.style.visibility = on ? 'visible' : 'hidden';
      });
      queryToolbarSidecars<HTMLDivElement>('angle-box').forEach((el) => {
        el.style.display = on ? 'table' : 'none';
      });
      const canvas = typeof document === 'undefined' ? null : document.getElementById('draw-canvas');
      if (canvas) canvas.style.cursor = on ? 'crosshair' : 'default';
      if (!on) resetPoints();
    },
    [resetPoints]
  );

  const onPick = useCallback(({ raw }: InteractiveToolPickContext) => {
    const next = pointsRef.current.length >= 3 ? [raw] : [...pointsRef.current, raw];
    pointsRef.current = next;
    setPoints(next);
    if (next.length === 3) {
      const degrees = computeAngle(next[0], next[1], next[2]);
      if (!Number.isNaN(degrees)) {
        onAngleRef.current?.(degrees, [next[0], next[1], next[2]]);
      }
    }
  }, []);

  useEffect(
    () =>
      registerInteractiveTool({
        id: ANGLE_TOOL_ID,
        enable: (presenter, enabled) => presenter.enablePickpointMode?.(enabled),
        syncUi,
        onPick
      }),
    [onPick, registerInteractiveTool, syncUi]
  );

  const entities = angleEntities(points);
  useSceneEntity('angle-points', () => entities.points, [points]);
  useSceneEntity('angle-lines', () => entities.lines, [points]);
  useSceneEntity('angle-wedge', () => entities.wedge, [points]);

  useToolbarSidecar(
    'angle-box',
    (
      <div
        id="angle-box"
        data-hop-sidecar="angle-box"
        data-hop-anchor={`${ANGLE_TOOL_ID},${ANGLE_TOOL_ID}_on`}
        className="output-box"
        style={{ pointerEvents: 'auto', display: isActive ? 'table' : 'none' }}
      >
        {label ?? 'Measured angle'}
        <hr />
        <CopyableOutput id="angle-output" value={displayValue} />
      </div>
    )
  );

  return (
    <ToggleImagePair
      primary={{ id: `${ANGLE_TOOL_ID}_on`, title: enabledTitle, src: enabledIcon, imgProps: enabledImgProps }}
      secondary={{ id: ANGLE_TOOL_ID, title: disabledTitle, src: disabledIcon, imgProps: disabledImgProps }}
    />
  );
};
