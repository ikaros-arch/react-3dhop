import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ThreeDHopViewerProvider } from '../src/viewer/context.js';
import { useInteractiveTools } from '../src/viewer/interactiveTools.js';
import type {
  InteractiveTool,
  LightObserver,
  SceneContribution,
  SceneObserver,
  SceneReadyObserver,
  ThemeName,
  ToolbarActionHandler,
  TrackballObserver,
  Vector3
} from '../src/viewer/types.js';
import type { MockPresenter } from './mockPresenter.js';

export type HarnessControls = {
  /** Simulate `applyScene`: setScene on the presenter, then notify scene observers. */
  applyScene: () => void;
  /** Simulate every mesh having loaded: `_testReady` then notify ready observers. */
  finishLoading: () => void;
  emitTrackball: (state: number[]) => void;
  emitLight: () => void;
  /** The presenter's pick callback as the lifecycle would install it. */
  pick: (raw: Vector3) => void;
  /** Simulates the presenter's `_onEndMeasurement(measure, pointA, pointB)` callback. */
  completeMeasurement: (pointA: Vector3, pointB: Vector3) => void;
  toggleTool: (toolId: InteractiveTool) => void;
  getActiveTool: () => InteractiveTool | null;
  /** Simulate a toolbar icon click reaching the lifecycle; true if a registered handler took it. */
  toolbarAction: (action: string) => boolean;
  captureToolState: (toolId?: InteractiveTool) => { toolId: InteractiveTool; state: unknown } | null;
  restoreToolState: (toolId: InteractiveTool, state: unknown) => void;
};

type HarnessProps = {
  presenter: MockPresenter | null;
  theme?: ThemeName;
  coordinateCorrections?: Vector3;
  /** Override to spy on scene-contribution registration (default: a no-op disposer). */
  registerSceneContribution?: (key: string, contribution: SceneContribution | null) => () => void;
  /** Override to spy on in-place scene-contribution updates (default: a no-op). */
  updateSceneContribution?: (key: string, contribution: SceneContribution) => void;
  controlsRef: React.MutableRefObject<HarnessControls | null>;
  children: React.ReactNode;
};

/**
 * Stands in for `ThreeDHopViewer` in tests: the same registries and the real
 * `useInteractiveTools`, but no 3DHOP scripts and no canvas. Test code drives scene/ready/light
 * events through `controlsRef`.
 */
export const ViewerHarness: React.FC<HarnessProps> = ({
  presenter,
  theme = 'light',
  coordinateCorrections = [0, 0, 0],
  registerSceneContribution = () => () => {},
  updateSceneContribution = () => {},
  controlsRef,
  children
}) => {
  const presenterRef = useRef(presenter);
  presenterRef.current = presenter;
  const activeInteractiveToolRef = useRef<InteractiveTool | null>(null);
  const sceneObservers = useRef(new Set<SceneObserver>());
  const readyObservers = useRef(new Set<SceneReadyObserver>());
  const trackballObservers = useRef(new Set<TrackballObserver>());
  const lightObservers = useRef(new Set<LightObserver>());
  const toolbarHandlers = useRef(new Map<string, Set<ToolbarActionHandler>>());
  const [measurementValue, setMeasurementValue] = useState<number | null>(null);
  const [measurementPoints, setMeasurementPoints] = useState<[Vector3, Vector3] | null>(null);
  const [pickpointValue, setPickpointValue] = useState<Vector3 | null>(null);

  const noopSync = useCallback(() => {}, []);
  const tools = useInteractiveTools({
    presenterRef,
    activeInteractiveToolRef,
    syncMeasurementUi: noopSync,
    syncPickpointUi: noopSync,
    setMeasurementValue,
    measurementPoints,
    setPickpointValue,
    pickpointValue
  });

  const register = <T,>(set: Set<T>) => (observer: T) => {
    set.add(observer);
    return () => {
      set.delete(observer);
    };
  };

  const registerSceneReadyObserver = useCallback((observer: SceneReadyObserver) => {
    readyObservers.current.add(observer);
    if (presenterRef.current?._isSceneReady?.()) observer(presenterRef.current);
    return () => {
      readyObservers.current.delete(observer);
    };
  }, []);

  const registerLightObserver = useCallback((observer: LightObserver) => {
    lightObservers.current.add(observer);
    const d = presenterRef.current?._lightDirection;
    if (Array.isArray(d)) observer([d[0], d[1], d[2]]);
    return () => {
      lightObservers.current.delete(observer);
    };
  }, []);

  controlsRef.current = {
    applyScene: () => {
      const p = presenterRef.current;
      if (!p) return;
      p.setScene({ meshes: p._scene.meshes, modelInstances: p._scene.modelInstances, space: p._scene.space });
      tools.reassertActiveTool(p); // as the lifecycle's setScene wrapper does
      sceneObservers.current.forEach((o) => o(p));
    },
    finishLoading: () => {
      const p = presenterRef.current;
      if (!p) return;
      p.__finishLoading();
      readyObservers.current.forEach((o) => o(p));
    },
    emitTrackball: (state) => trackballObservers.current.forEach((o) => o(state)),
    emitLight: () => {
      const d = presenterRef.current?._lightDirection;
      if (Array.isArray(d)) lightObservers.current.forEach((o) => o([d[0], d[1], d[2]]));
    },
    pick: (raw) => {
      const p = presenterRef.current;
      if (!p) return;
      tools.dispatchPick({
        raw,
        corrected: [raw[0] + coordinateCorrections[0], raw[1] + coordinateCorrections[1], raw[2] + coordinateCorrections[2]],
        presenter: p
      });
    },
    completeMeasurement: (pointA, pointB) => {
      setMeasurementValue(Math.hypot(pointA[0] - pointB[0], pointA[1] - pointB[1], pointA[2] - pointB[2]));
      setMeasurementPoints([pointA, pointB]);
    },
    toggleTool: (toolId) => tools.toggleTool(toolId, presenterRef.current),
    getActiveTool: () => activeInteractiveToolRef.current,
    captureToolState: (toolId) => tools.captureToolState(toolId),
    restoreToolState: (toolId, state) => tools.restoreToolState(toolId, state),
    toolbarAction: (action) => {
      const p = presenterRef.current;
      if (!p) return false;
      let handled = false;
      toolbarHandlers.current.get(action)?.forEach((h) => {
        if (h(p, action) === true) handled = true;
      });
      return handled;
    }
  };

  const registerToolbarAction = useCallback((actions: string | string[], handler: ToolbarActionHandler) => {
    const list = Array.isArray(actions) ? actions : [actions];
    list.forEach((a) => {
      if (!toolbarHandlers.current.has(a)) toolbarHandlers.current.set(a, new Set());
      toolbarHandlers.current.get(a)!.add(handler);
    });
    return () => list.forEach((a) => toolbarHandlers.current.get(a)?.delete(handler));
  }, []);

  // Mirrors `controlsRef.current.toolbarAction` (registry dispatch only - this harness has no
  // presenter-driven built-ins to simulate, same as the real lifecycle's narrow internal dispatch
  // before its built-in switch statement).
  const triggerToolbarAction = useCallback((action: string) => {
    const p = presenterRef.current;
    if (!p) return;
    toolbarHandlers.current.get(action)?.forEach((h) => h(p, action));
  }, []);

  const registerSceneObserver = useMemo(() => register(sceneObservers.current), []);
  const registerTrackballObserver = useMemo(() => register(trackballObservers.current), []);
  const toggleInteractiveTool = useCallback((id: InteractiveTool) => tools.toggleTool(id, presenterRef.current), [tools]);

  return (
    <ThreeDHopViewerProvider
      presenter={presenter}
      assetBaseUrl="/3dhop"
      registerSceneContribution={registerSceneContribution}
      updateSceneContribution={updateSceneContribution}
      registerToolbarAction={registerToolbarAction}
      triggerToolbarAction={triggerToolbarAction}
      registerSceneObserver={registerSceneObserver}
      registerSceneReadyObserver={registerSceneReadyObserver}
      registerTrackballObserver={registerTrackballObserver}
      registerLightObserver={registerLightObserver}
      registerAnnotationHandler={() => () => {}}
      registerInteractiveTool={tools.registerInteractiveTool}
      toggleInteractiveTool={toggleInteractiveTool}
      activeInteractiveTool={tools.activeInteractiveTool}
      captureToolState={tools.captureToolState}
      restoreToolState={tools.restoreToolState}
      realignToolbar={() => {}}
      theme={theme}
      hasHotspotContribution={false}
      measurementUnits="mm"
      measurementValue={measurementValue}
      pickpointValue={pickpointValue}
      setMeasurementValue={setMeasurementValue}
      setPickpointValue={setPickpointValue}
      coordinateCorrections={{ x: coordinateCorrections[0], y: coordinateCorrections[1], z: coordinateCorrections[2] }}
    >
      {children}
    </ThreeDHopViewerProvider>
  );
};
