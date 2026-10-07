/**
 * Renders the 3DHOP canvas and coordinates the supporting hooks that bootstrap the
 * presenter, manage toolbar interactions, and expose viewer state to descendants via
 * context. The component centralizes orchestration logic so external consumers only
 * supply configuration and optional children.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FullscreenControl,
  HomeControl,
  LightControl,
  HotspotControl,
  Toolbar,
  ToolbarAssetsProvider,
  ZoomInControl,
  ZoomOutControl
} from './Toolbar';
import type { AnnotationDefinition } from './utils/annotations.js';
import { resolveRelativeAssetPath } from './utils/assetPaths.js';
import { useStableValue } from './utils/stableValue.js';
import { resolveBackgroundUrl } from './viewer/dom';
import { ThreeDHopViewerProvider } from './viewer/context.js';
import { useSceneConfiguration } from './viewer/sceneBuilder';
import { usePresenterLifecycle } from './viewer/presenterLifecycle.js';
import { useToolbarSync } from './viewer/toolbarSync.js';
import { useInteractiveTools, type InteractiveTool } from './viewer/interactiveTools.js';
import { resolveThemeMode, themeStyle } from './theme.js';
import {
  type AnnotationPickEvent,
  type AnnotationPickHandler,
  type CoordinateCorrections,
  type LightObserver,
  type PresenterInstance,
  type SceneContribution,
  type SceneObserver,
  type SceneReadyObserver,
  type ThemeName,
  type ThreeDHopViewerProps,
  type ToolbarActionHandler,
  type TrackballObserver,
  type Vector3
} from './viewer/types';

declare global {
  interface Window {
    Presenter: new (canvasId: string) => PresenterInstance;
    TurnTableTrackball: unknown;
    init3dhop?: () => void;
    lightSwitch?: (on?: boolean) => void;
    lightingSwitch?: (on?: boolean) => void;
    cameraSwitch?: (on?: boolean) => void;
    colorSwitch?: (on?: boolean) => void;
    transparencySwitch?: (on?: boolean) => void;
    specularSwitch?: (on?: boolean) => void;
    measureSwitch?: (on?: boolean) => void;
    pickpointSwitch?: (on?: boolean) => void;
    hotspotSwitch?: (on?: boolean) => void;
    fullscreenSwitch?: () => void;
    actionsToolbar?: (action: string) => void;
    presenter: PresenterInstance | null | undefined;
    sectiontoolSwitch?: (on?: boolean) => void;
    sectiontoolReset?: () => void;
    sectiontoolInit?: () => void;
    sectionxSwitch?: (on?: boolean) => void;
    sectionySwitch?: (on?: boolean) => void;
    sectionzSwitch?: (on?: boolean) => void;
    onTrackballUpdate?: (trackState: number[]) => void;
  }
  const HOP_ALL: unknown;
}

export type {
  AnnotationPickEvent,
  AnnotationPickHandler,
  CameraType,
  CoordinateCorrections,
  InteractiveTool,
  InteractiveToolConfig,
  InteractiveToolPickContext,
  LightObserver,
  ModelDefinition,
  ModelInstanceConfiguration,
  ModelTransparencyOptions,
  ModelTransformConfig,
  PresenterInstance,
  SceneBounds,
  SceneConfiguration,
  SceneContribution,
  SceneEntity,
  SceneEntitySpec,
  SceneEntityType,
  SceneMeshDefinition,
  SceneMeshes,
  SceneObserver,
  SceneReadyObserver,
  SceneRenderConfig,
  SceneSpaceConfig,
  ThemeMode,
  ThemeName,
  ThreeDHopViewerContextValue,
  ThreeDHopViewerProps,
  ToolbarActionHandler,
  TrackballConfig,
  TrackballName,
  TrackballObserver,
  TrackOptions,
  Vector3
} from './viewer/types.js';
export { useThreeDHopViewer } from './viewer/context.js';

/**
 * Top-level React component embedding a configured 3DHOP presenter and optional toolbar.
 * Accepts model definitions, background assets, toolbar contributions, and exposes viewer
 * state to nested components through the `ThreeDHopViewerProvider` interface.
 */
export const ThreeDHopViewer: React.FC<ThreeDHopViewerProps> = ({
  assetBaseUrl = '/node_modules/@ikaros-arch/3dhop',
  modelUrl,
  models,
  backgroundUrl,
  className,
  style,
  width = '100%',
  height = '100%',
  showToolbar = true,
  measurementUnits = 'mm',
  coordinateCorrections,
  space,
  config,
  trackball,
  nexusTargetError,
  theme: themeMode,
  toolbar,
  children
}) => {
  const presenterRef = useRef<PresenterInstance | null>(null);
  const sceneContributionsRef = useRef<Map<string, SceneContribution>>(new Map());
  const [sceneContributionsVersion, setSceneContributionsVersion] = useState(0);
  const toolbarHandlersRef = useRef<Map<string, Set<ToolbarActionHandler>>>(new Map());
  const sceneObserversRef = useRef<Set<SceneObserver>>(new Set());
  const sceneReadyObserversRef = useRef<Set<SceneReadyObserver>>(new Set());
  const trackballObserversRef = useRef<Set<TrackballObserver>>(new Set());
  const lightObserversRef = useRef<Set<LightObserver>>(new Set());
  const annotationHandlersRef = useRef<Set<AnnotationPickHandler>>(new Set());
  const annotationDefinitionsRef = useRef<Map<string, AnnotationDefinition>>(new Map());
  const [hasHotspotContribution, setHasHotspotContribution] = useState(false);
  const [measurementValue, setMeasurementValue] = useState<number | null>(null);
  const [measurementPoints, setMeasurementPoints] = useState<[Vector3, Vector3] | null>(null);
  const [pickpointValue, setPickpointValue] = useState<[number, number, number] | null>(null);
  const activeInteractiveToolRef = useRef<InteractiveTool | null>(null);

  const {
    alignToolbarSidecars,
    syncMeasurementUi,
    syncPickpointUi,
    syncSectionsUi,
    syncLightSwitch,
    syncLightingSwitch,
    syncColorSwitch,
    syncTransparencySwitch,
    syncSpecularUi,
    syncCameraSwitch,
    syncHotspotSwitch,
    syncFullscreenUi,
    syncInfoUi,
    setInfoVisibility,
    toggleInfoVisibility,
    isControlVisible,
    infoBoxVisibleRef
  } = useToolbarSync({
    presenterRef,
    activeInteractiveToolRef,
    setMeasurementValue,
    setPickpointValue
  });

  const {
    toggleTool,
    deactivateTool,
    resetActiveTool,
    reassertActiveTool,
    registerInteractiveTool,
    dispatchPick,
    hasTool,
    activeInteractiveTool,
    captureToolState,
    restoreToolState
  } = useInteractiveTools({
    presenterRef,
    activeInteractiveToolRef,
    syncMeasurementUi,
    syncPickpointUi,
    setPickpointValue,
    pickpointValue,
    setMeasurementValue,
    measurementPoints
  });

  /** Context-facing toggle: always targets the live presenter. */
  const toggleInteractiveTool = useCallback(
    (toolId: InteractiveTool) => {
      toggleTool(toolId, presenterRef.current);
    },
    [toggleTool]
  );

  /**
   * Resolves the `theme` prop, following the OS preference live when set to `'system'`.
   */
  const [prefersDark, setPrefersDark] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (themeMode !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setPrefersDark(undefined);
      return;
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(query.matches);
    const listener = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, [themeMode]);
  const resolvedTheme = useMemo<ThemeName>(() => resolveThemeMode(themeMode, prefersDark), [themeMode, prefersDark]);

  /**
   * Normalizes human-readable measurement units for display alongside measurement values.
   */
  const measurementUnitLabel = useMemo(() => {
    const trimmed = measurementUnits.trim();
    return trimmed.length > 0 ? trimmed : '';
  }, [measurementUnits]);

  /**
   * Ensures coordinate corrections fall back to zeros so the presenter receives a fully
   * populated object regardless of which axes the caller overrides.
   */
  const resolvedCoordinateCorrections = useMemo<Required<CoordinateCorrections>>(
    () => ({
      x: coordinateCorrections?.x ?? 0,
      y: coordinateCorrections?.y ?? 0,
      z: coordinateCorrections?.z ?? 0
    }),
    [coordinateCorrections?.x, coordinateCorrections?.y, coordinateCorrections?.z]
  );

  /**
   * Forces React to propagate scene contribution changes so the builder recomputes the
   * target configuration whenever contributors register or unregister.
   */
  const bumpSceneContributionsVersion = useCallback(() => {
    setSceneContributionsVersion((value) => value + 1);
  }, []);

  /**
   * Registers a scene contribution under a unique key and schedules an update when the
   * contribution changes or disappears.
   */
  const registerSceneContribution = useCallback(
    (key: string, contribution: SceneContribution | null) => {
      const map = sceneContributionsRef.current;

      let changed = false;

      if (contribution) {
        map.set(key, contribution);
        changed = true;
      } else {
        changed = map.delete(key);
      }

      if (changed) {
        bumpSceneContributionsVersion();
      }

      return () => {
        if (map.delete(key)) {
          bumpSceneContributionsVersion();
        }
      };
    },
    [bumpSceneContributionsVersion]
  );

  /**
   * Subscribes toolbar actions to presenter callbacks so multiple handlers can respond to
   * the same toolbar event while allowing removal via the returned disposer.
   */
  const registerToolbarAction = useCallback((actions: string | string[], handler: ToolbarActionHandler) => {
    const actionList = Array.isArray(actions) ? actions : [actions];

    actionList.forEach((action) => {
      let handlers = toolbarHandlersRef.current.get(action);
      if (!handlers) {
        handlers = new Set();
        toolbarHandlersRef.current.set(action, handlers);
      }
      if (!handlers.has(handler)) {
        handlers.add(handler);
      }
    });

    return () => {
      actionList.forEach((action) => {
        const handlers = toolbarHandlersRef.current.get(action);
        if (!handlers) {
          return;
        }
        handlers.delete(handler);
        if (handlers.size === 0) {
          toolbarHandlersRef.current.delete(action);
        }
      });
    };
  }, []);

  /**
   * Tracks scene observers that react to presenter lifecycle milestones, removing them on
   * cleanup to avoid leaking references outside the viewer component.
   */
  const registerSceneObserver = useCallback((observer: SceneObserver) => {
    sceneObserversRef.current.add(observer);
    return () => {
      sceneObserversRef.current.delete(observer);
    };
  }, []);

  /**
   * Scene-ready observers fire once per scene apply, after every mesh has loaded. A subscriber
   * arriving while the scene is already ready is called back immediately.
   */
  const registerSceneReadyObserver = useCallback((observer: SceneReadyObserver) => {
    sceneReadyObserversRef.current.add(observer);
    const presenter = presenterRef.current;
    if (presenter && presenter._isSceneReady?.()) {
      observer(presenter);
    }
    return () => {
      sceneReadyObserversRef.current.delete(observer);
    };
  }, []);

  const notifySceneReadyObservers = useCallback((presenter: PresenterInstance) => {
    sceneReadyObserversRef.current.forEach((observer) => {
      observer(presenter);
    });
  }, []);

  const notifyLightObservers = useCallback((direction: Vector3) => {
    lightObserversRef.current.forEach((observer) => {
      observer(direction);
    });
  }, []);

  /**
   * Light observers receive 3DHOP's `_lightDirection` on every change; a new subscriber gets the
   * current value straight away.
   */
  const registerLightObserver = useCallback((observer: LightObserver) => {
    lightObserversRef.current.add(observer);
    const direction = presenterRef.current?._lightDirection;
    if (Array.isArray(direction) && direction.length >= 3) {
      observer([direction[0], direction[1], direction[2]]);
    }
    return () => {
      lightObserversRef.current.delete(observer);
    };
  }, []);

  /**
   * Notifies every trackball observer with the latest track state emitted from the
   * presenter so external components can sync camera widgets.
   */
  const notifyTrackballObservers = useCallback((trackState: number[]) => {
    trackballObserversRef.current.forEach((observer) => {
      observer(trackState);
    });
  }, []);

  /**
   * Registers a trackball observer and ensures it is removed once the caller disposes of
   * the subscription.
   */
  const registerTrackballObserver = useCallback((observer: TrackballObserver) => {
    trackballObserversRef.current.add(observer);
    return () => {
      trackballObserversRef.current.delete(observer);
    };
  }, []);

  /**
   * Emits annotation pick events to every subscribed handler whenever the presenter
   * identifies an interactive hotspot selection.
   */
  const dispatchAnnotationPick = useCallback((event: AnnotationPickEvent) => {
    annotationHandlersRef.current.forEach((handler) => {
      handler(event);
    });
  }, []);

  /**
   * Registers an annotation pick handler and returns a disposer that detaches the handler
   * to prevent duplicate notifications.
   */
  const registerAnnotationHandler = useCallback((handler: AnnotationPickHandler) => {
    annotationHandlersRef.current.add(handler);
    return () => {
      annotationHandlersRef.current.delete(handler);
    };
  }, []);

  /**
   * Dispatches a toolbar action through any registered handlers until one reports success,
   * mirroring 3DHOP's imperative toolbar event contract.
   */
  const dispatchToolbarAction = useCallback((action: string, presenter: PresenterInstance) => {
    const handlers = toolbarHandlersRef.current.get(action);
    if (!handlers || handlers.size === 0) {
      return false;
    }

    for (const handler of handlers) {
      const handled = handler(presenter, action);
      if (handled) {
        return true;
      }
    }

    return false;
  }, []);

  /**
   * Ensures asset base URLs omit redundant trailing slashes so downstream path resolution
   * can safely concatenate segments.
   */
  const normalizedBaseUrl = useMemo(() => {
    if (assetBaseUrl.endsWith('/') && assetBaseUrl !== '/') {
      return assetBaseUrl.slice(0, -1);
    }
    return assetBaseUrl;
  }, [assetBaseUrl]);

  /**
   * Resolves the primary model URL: absolute URLs pass through, relative paths resolve against
   * `assetBaseUrl`. `null` when no `modelUrl` is given — there is no bundled default model.
   */
  const resolvedModelUrl = useMemo<string | null>(
    () => (modelUrl ? resolveRelativeAssetPath(modelUrl, normalizedBaseUrl, modelUrl) : null),
    [modelUrl, normalizedBaseUrl]
  );

  /**
   * Produces the final background texture URL, honoring overrides while falling back to
   * the theme-specific defaults.
   */
  const resolvedBackgroundUrl = useMemo(
    () => resolveBackgroundUrl(backgroundUrl, normalizedBaseUrl),
    [backgroundUrl, normalizedBaseUrl]
  );

  // These are typically written as inline literals; keeping them stable by value stops the scene
  // from being rebuilt on every render.
  const stableSpace = useStableValue(space);
  const stableConfig = useStableValue(config);
  const stableTrackball = useStableValue(trackball);

  const { applyScene } = useSceneConfiguration({
    models,
    normalizedBaseUrl,
    resolvedModelUrl,
    sceneContributionsRef,
    sceneContributionsVersion,
    annotationDefinitionsRef,
    notifyTrackballObservers,
    setHasHotspotContribution,
    sceneObserversRef,
    syncTransparencySwitch,
    syncSpecularUi,
    syncSectionsUi,
    space: stableSpace,
    config: stableConfig,
    trackball: stableTrackball,
    nexusTargetError
  });

  const { presenterState, triggerToolbarAction } = usePresenterLifecycle({
    presenterRef,
    normalizedBaseUrl,
    applyScene,
    notifyTrackballObservers,
    notifySceneReadyObservers,
    notifyLightObservers,
    dispatchToolbarAction,
    toggleTool,
    hasTool,
    dispatchPick,
    toggleInfoVisibility,
    isControlVisible,
    syncFullscreenUi,
    syncMeasurementUi,
    syncPickpointUi,
    syncSectionsUi,
    syncLightSwitch,
    syncLightingSwitch,
    syncColorSwitch,
    syncTransparencySwitch,
    syncSpecularUi,
    syncCameraSwitch,
    syncHotspotSwitch,
    setMeasurementValue,
    setMeasurementPoints,
    resolvedCoordinateCorrections,
    dispatchAnnotationPick,
    annotationDefinitionsRef,
    annotationHandlersRef,
    trackballObserversRef,
    resetActiveTool,
    reassertActiveTool
  });

  useEffect(() => {
    alignToolbarSidecars();
    syncInfoUi(infoBoxVisibleRef.current);
  }, [alignToolbarSidecars, syncInfoUi]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('resize', alignToolbarSidecars);
    return () => {
      window.removeEventListener('resize', alignToolbarSidecars);
    };
  }, [alignToolbarSidecars]);

  useEffect(() => {
    const presenter = presenterRef.current;
    if (!presenter) {
      return;
    }

    applyScene(presenter, true);
  }, [applyScene]);

  const toolbarChildren: React.ReactNode[] = [];
  const otherChildren: React.ReactNode[] = [];

  if (toolbar !== undefined && toolbar !== null) {
    // An explicit `toolbar` prop always wins: `children` can't be scanned for a wrapped `<Toolbar>`
    // anyway (see the prop's doc comment), so everything in it is just other content.
    toolbarChildren.push(toolbar);
    React.Children.forEach(children, (child) => {
      if (child) {
        otherChildren.push(child);
      }
    });
  } else {
    React.Children.forEach(children, (child) => {
      if (!child) {
        return;
      }
      if (React.isValidElement(child) && child.type === Toolbar) {
        toolbarChildren.push(child);
      } else {
        otherChildren.push(child);
      }
    });
  }

  const hasProvidedToolbar = toolbarChildren.length > 0;
  const toolbarCount = toolbarChildren.length;

  useEffect(() => {
    alignToolbarSidecars();
    syncInfoUi(infoBoxVisibleRef.current);
  }, [alignToolbarSidecars, syncInfoUi, toolbarCount, hasHotspotContribution]);

  return (
    <ThreeDHopViewerProvider
      presenter={presenterState}
      assetBaseUrl={normalizedBaseUrl}
      registerSceneContribution={registerSceneContribution}
      registerToolbarAction={registerToolbarAction}
      triggerToolbarAction={triggerToolbarAction}
      registerSceneObserver={registerSceneObserver}
      registerSceneReadyObserver={registerSceneReadyObserver}
      registerTrackballObserver={registerTrackballObserver}
      registerLightObserver={registerLightObserver}
      registerAnnotationHandler={registerAnnotationHandler}
      registerInteractiveTool={registerInteractiveTool}
      toggleInteractiveTool={toggleInteractiveTool}
      activeInteractiveTool={activeInteractiveTool}
      captureToolState={captureToolState}
      restoreToolState={restoreToolState}
      realignToolbar={alignToolbarSidecars}
      theme={resolvedTheme}
      hasHotspotContribution={hasHotspotContribution}
      measurementUnits={measurementUnitLabel}
      measurementValue={measurementValue}
      pickpointValue={pickpointValue}
      setMeasurementValue={setMeasurementValue}
      setPickpointValue={setPickpointValue}
      coordinateCorrections={resolvedCoordinateCorrections}
    >
      <ToolbarAssetsProvider assetBaseUrl={normalizedBaseUrl}>
        <div
          className={className}
          data-r3dhop-theme={resolvedTheme}
          style={{
            position: 'relative',
            width,
            height,
            overflow: 'hidden',
            ...themeStyle(resolvedTheme),
            ...style
          }}
        >
          <div
            id="3dhop"
            className="tdhop"
            onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => {
              if (event.preventDefault) {
                event.preventDefault();
              }
            }}
          >
            <div id="tdhlg" />
            {showToolbar ? (
              <div
                id="toolbar"
                data-hop-toolbar-container="true"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              >
                {(hasProvidedToolbar
                  ? toolbarChildren
                  : [
                      <Toolbar key="default-toolbar">
                        <HomeControl />
                        <ZoomInControl />
                        <ZoomOutControl />
                        <LightControl />
                        {hasHotspotContribution ? <HotspotControl /> : null}
                        <FullscreenControl />
                      </Toolbar>
                    ]
                ).map((element, index) => {
                  if (!React.isValidElement(element)) {
                    return element;
                  }
                  if (element.key != null) {
                    return element;
                  }
                  return React.cloneElement(element, { key: `toolbar-${index}` });
                })}
              </div>
            ) : null}
            <canvas
              id="draw-canvas"
              style={
                resolvedBackgroundUrl ? { backgroundImage: `url(${resolvedBackgroundUrl})` } : undefined
              }
            />
          </div>
          {otherChildren.length > 0 ? otherChildren : null}
        </div>
      </ToolbarAssetsProvider>
    </ThreeDHopViewerProvider>
  );
};
