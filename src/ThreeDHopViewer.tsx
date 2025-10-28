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
import { getHopAllTag } from './utils/hopTags';
import type { AnnotationDefinition } from './utils/annotations.js';
import { joinAssetPath, resolveRelativeAssetPath } from './utils/assetPaths.js';
import { ensureAssets } from './viewer/assets';
import { queryToolbarElements, resolveBackgroundUrl } from './viewer/dom';
import { ThreeDHopViewerProvider } from './viewer/context.js';
import { useSceneConfiguration } from './viewer/sceneBuilder';
import { useToolbarSync } from './viewer/toolbarSync.js';
import { useInteractiveTools, type InteractiveTool } from './viewer/interactiveTools.js';
import {
  type AnnotationPickEvent,
  type AnnotationPickHandler,
  type CoordinateCorrections,
  type ModelDefinition,
  type ModelTransparencyOptions,
  type ModelTransformConfig,
  type PresenterInstance,
  type SceneContribution,
  type SceneObserver,
  type ThreeDHopViewerContextValue,
  type ThreeDHopViewerProps,
  type ToolbarActionHandler,
  type TrackballObserver
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
  CoordinateCorrections,
  ModelDefinition,
  ModelTransparencyOptions,
  ModelTransformConfig,
  PresenterInstance,
  SceneContribution,
  SceneObserver,
  ThreeDHopViewerContextValue,
  ThreeDHopViewerProps,
  ToolbarActionHandler,
  TrackballObserver
} from './viewer/types.js';
export { useThreeDHopViewer } from './viewer/context.js';

export const ThreeDHopViewer: React.FC<ThreeDHopViewerProps> = ({
  assetBaseUrl = '/node_modules/react-3dhop/dist/3dhop',
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
  children
}) => {
  const presenterRef = useRef<PresenterInstance | null>(null);
  const previousActionsRef = useRef<typeof window.actionsToolbar>();
  const previousPresenterRef = useRef<typeof window.presenter>();
  const previousOnEndMeasurementRef = useRef<PresenterInstance['_onEndMeasurement']>();
  const previousOnEndPickingPointRef = useRef<PresenterInstance['_onEndPickingPoint']>();
  const previousMeasureSwitchRef = useRef<typeof window.measureSwitch>();
  const previousPickpointSwitchRef = useRef<typeof window.pickpointSwitch>();
  const previousOnTrackballUpdateRef = useRef<typeof window.onTrackballUpdate>();
  const [presenterState, setPresenterState] = useState<PresenterInstance | null>(null);
  const previousLightSwitchRef = useRef<typeof window.lightSwitch>();
  const previousLightingSwitchRef = useRef<typeof window.lightingSwitch>();
  const previousCameraSwitchRef = useRef<typeof window.cameraSwitch>();
  const previousColorSwitchRef = useRef<typeof window.colorSwitch>();
  const previousTransparencySwitchRef = useRef<typeof window.transparencySwitch>();
  const previousSpecularSwitchRef = useRef<typeof window.specularSwitch>();
  const previousHotspotSwitchRef = useRef<typeof window.hotspotSwitch>();
  const previousSectiontoolSwitchRef = useRef<typeof window.sectiontoolSwitch>();
  const previousOnPickedSpotRef = useRef<PresenterInstance['_onPickedSpot']>();
  const sceneContributionsRef = useRef<Map<string, SceneContribution>>(new Map());
  const [sceneContributionsVersion, setSceneContributionsVersion] = useState(0);
  const toolbarHandlersRef = useRef<Map<string, Set<ToolbarActionHandler>>>(new Map());
  const sceneObserversRef = useRef<Set<SceneObserver>>(new Set());
  const trackballObserversRef = useRef<Set<TrackballObserver>>(new Set());
  const annotationHandlersRef = useRef<Set<AnnotationPickHandler>>(new Set());
  const annotationDefinitionsRef = useRef<Map<string, AnnotationDefinition>>(new Map());
  const [hasHotspotContribution, setHasHotspotContribution] = useState(false);
  const [measurementValue, setMeasurementValue] = useState<number | null>(null);
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

  const { toggleTool, deactivateTool, resetActiveTool } = useInteractiveTools({
    presenterRef,
    activeInteractiveToolRef,
    syncMeasurementUi,
    syncPickpointUi
  });

  const measurementUnitLabel = useMemo(() => {
    const trimmed = measurementUnits.trim();
    return trimmed.length > 0 ? trimmed : '';
  }, [measurementUnits]);

  const resolvedCoordinateCorrections = useMemo<Required<CoordinateCorrections>>(
    () => ({
      x: coordinateCorrections?.x ?? 0,
      y: coordinateCorrections?.y ?? 0,
      z: coordinateCorrections?.z ?? 0
    }),
    [coordinateCorrections?.x, coordinateCorrections?.y, coordinateCorrections?.z]
  );

  const bumpSceneContributionsVersion = useCallback(() => {
    setSceneContributionsVersion((value) => value + 1);
  }, []);

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

  const registerSceneObserver = useCallback((observer: SceneObserver) => {
    sceneObserversRef.current.add(observer);
    return () => {
      sceneObserversRef.current.delete(observer);
    };
  }, []);

  const notifyTrackballObservers = useCallback((trackState: number[]) => {
    trackballObserversRef.current.forEach((observer) => {
      observer(trackState);
    });
  }, []);

  const registerTrackballObserver = useCallback((observer: TrackballObserver) => {
    trackballObserversRef.current.add(observer);
    return () => {
      trackballObserversRef.current.delete(observer);
    };
  }, []);

  const dispatchAnnotationPick = useCallback((event: AnnotationPickEvent) => {
    annotationHandlersRef.current.forEach((handler) => {
      handler(event);
    });
  }, []);

  const registerAnnotationHandler = useCallback((handler: AnnotationPickHandler) => {
    annotationHandlersRef.current.add(handler);
    return () => {
      annotationHandlersRef.current.delete(handler);
    };
  }, []);

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

  const normalizedBaseUrl = useMemo(() => {
    if (assetBaseUrl.endsWith('/') && assetBaseUrl !== '/') {
      return assetBaseUrl.slice(0, -1);
    }
    return assetBaseUrl;
  }, [assetBaseUrl]);

  const resolvedModelUrl = useMemo(
    () => resolveRelativeAssetPath(modelUrl, normalizedBaseUrl, joinAssetPath(normalizedBaseUrl, 'models/gargo.nxz')),
    [modelUrl, normalizedBaseUrl]
  );

  const resolvedBackgroundUrl = useMemo(
    () => resolveBackgroundUrl(backgroundUrl, normalizedBaseUrl),
    [backgroundUrl, normalizedBaseUrl]
  );

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
    syncSectionsUi
  });

  useEffect(() => {
    let disposed = false;

    const trackballUpdateHandler = (trackState: number[]) => {
      notifyTrackballObservers(trackState);
      const previous = previousOnTrackballUpdateRef.current;
      if (previous && previous !== trackballUpdateHandler) {
        previous(trackState);
      }
    };

    const toolbarHandler = (action: string) => {
      const presenter = presenterRef.current;
      if (!presenter) return;

      if (dispatchToolbarAction(action, presenter)) {
        return;
      }

      switch (action) {
        case 'home':
          presenter.resetTrackball();
          break;
        case 'zoomin':
          presenter.zoomIn();
          break;
        case 'zoomout':
          presenter.zoomOut();
          break;
        case 'light':
        case 'light_on':
          presenter.enableLightTrackball(!presenter.isLightTrackballEnabled());
          window.lightSwitch?.();
          break;
        case 'lighting':
        case 'lighting_off':
          if (typeof presenter.enableSceneLighting === 'function' && typeof presenter.isSceneLightingEnabled === 'function') {
            presenter.enableSceneLighting(!presenter.isSceneLightingEnabled());
          }
          window.lightingSwitch?.();
          break;
        case 'perspective':
        case 'orthographic':
          presenter.toggleCameraType?.();
          window.cameraSwitch?.();
          break;
        case 'color':
        case 'color_on':
          presenter.toggleInstanceSolidColor?.(getHopAllTag(), true);
          window.colorSwitch?.();
          break;
        case 'hotspot':
        case 'hotspot_on': {
          const currentlyVisible =
            typeof presenter.isSpotVisibilityEnabled === 'function'
              ? presenter.isSpotVisibilityEnabled(getHopAllTag())
              : isControlVisible('hotspot_on') ?? false;
          const nextVisible = !currentlyVisible;
          presenter.setSpotVisibility?.(getHopAllTag(), nextVisible, true);
          presenter.enableOnHover?.(nextVisible);
          presenter.ui?.postDrawEvent?.();
          window.hotspotSwitch?.(nextVisible);
          break;
        }
        case 'transparency':
        case 'transparency_on': {
          const presentersTransparency =
            typeof presenter.isInstanceTransparencyEnabled === 'function'
              ? presenter.isInstanceTransparencyEnabled(getHopAllTag())
              : isControlVisible('transparency_on') ?? false;
          const nextTransparency = !presentersTransparency;

          if (typeof presenter.setInstanceTransparency === 'function') {
            presenter.setInstanceTransparency(getHopAllTag(), nextTransparency, true);
          } else if (presenter._scene?.modelInstances) {
            Object.values(presenter._scene.modelInstances).forEach((instance) => {
              if (instance) {
                (instance as { useTransparency?: boolean }).useTransparency = nextTransparency;
              }
            });
            presenter.repaint?.();
          }
          window.transparencySwitch?.(nextTransparency);
          break;
        }
        case 'specular':
        case 'specular_on': {
          const instances = presenter._scene?.modelInstances as
            | Record<string, { specularColor?: number[] }>
            | undefined;
          const isCurrentlySpecular = instances
            ? Object.values(instances).some((instance) => {
                if (!instance) {
                  return false;
                }
                const specular = instance.specularColor;
                if (!Array.isArray(specular) || specular.length < 3) {
                  return false;
                }
                const [r = 0, g = 0, b = 0] = specular;
                return Math.abs(r) > 1e-3 || Math.abs(g) > 1e-3 || Math.abs(b) > 1e-3;
              })
            : isControlVisible('specular_on') ?? false;
          const nextSpecular = !isCurrentlySpecular;
          const specularColor: [number, number, number] = nextSpecular ? [0.3, 0.3, 0.3] : [0.0, 0.0, 0.0];

          if (typeof presenter.setInstanceSpecularity === 'function') {
            presenter.setInstanceSpecularity(getHopAllTag(), specularColor, 256.0, true);
          } else if (instances) {
            const updated = [...specularColor, 256.0];
            Object.values(instances).forEach((instance) => {
              if (instance) {
                instance.specularColor = updated;
              }
            });
            presenter.repaint?.();
          }
          window.specularSwitch?.(nextSpecular);
          break;
        }
        case 'measure':
        case 'measure_on': {
          toggleTool('measure', presenter);
          break;
        }
        case 'pick':
        case 'pick_on': {
          toggleTool('pick', presenter);
          break;
        }
        case 'sections':
        case 'sections_on':
          window.sectiontoolReset?.();
          window.sectiontoolSwitch?.();
          break;
        case 'screenshot':
          presenter.saveScreenshot?.();
          break;
        case 'full':
        case 'full_on':
          window.fullscreenSwitch?.();
          break;
        case 'info':
        case 'info_on':
          toggleInfoVisibility();
          break;
        default:
          break;
      }
    };

    const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'] as const;

    const getFullscreenElement = () =>
      document.fullscreenElement ??
      (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ??
      (document as Document & { mozFullScreenElement?: Element | null }).mozFullScreenElement ??
      (document as Document & { msFullscreenElement?: Element | null }).msFullscreenElement ??
      null;

    const handleFullscreenChange = () => {
      const isActive = Boolean(getFullscreenElement());
      syncFullscreenUi(isActive);
    };

    const sectiontoolSwitchProxy = (state?: boolean) => {
      const previous = previousSectiontoolSwitchRef.current;
      const result = previous?.(state);
      syncSectionsUi();
      return result;
    };

    const setup = async () => {
      try {
    previousActionsRef.current = window.actionsToolbar;
    previousPresenterRef.current = window.presenter;
    previousOnTrackballUpdateRef.current = window.onTrackballUpdate;
    window.onTrackballUpdate = trackballUpdateHandler;

    await ensureAssets(normalizedBaseUrl);
    if (disposed) return;

    previousMeasureSwitchRef.current = window.measureSwitch;
    previousPickpointSwitchRef.current = window.pickpointSwitch;
    window.measureSwitch = syncMeasurementUi;
    window.pickpointSwitch = syncPickpointUi;

  previousSectiontoolSwitchRef.current = window.sectiontoolSwitch;
  window.sectiontoolSwitch = sectiontoolSwitchProxy;

  previousLightSwitchRef.current = window.lightSwitch;
  previousLightingSwitchRef.current = window.lightingSwitch;
  previousColorSwitchRef.current = window.colorSwitch;
  previousCameraSwitchRef.current = window.cameraSwitch;
  previousTransparencySwitchRef.current = window.transparencySwitch;
  previousSpecularSwitchRef.current = window.specularSwitch;
  previousHotspotSwitchRef.current = window.hotspotSwitch;

    window.lightSwitch = (state?: boolean) => {
      syncLightSwitch(state);
    };

    window.lightingSwitch = (state?: boolean) => {
      syncLightingSwitch(state);
    };

    window.colorSwitch = (state?: boolean) => {
      syncColorSwitch(state);
    };

    window.cameraSwitch = (state?: boolean) => {
      syncCameraSwitch(state);
    };

    window.transparencySwitch = (state?: boolean) => {
      syncTransparencySwitch(state);
    };

    window.specularSwitch = (state?: boolean) => {
      syncSpecularUi(state);
    };

    window.hotspotSwitch = (state?: boolean) => {
      syncHotspotSwitch(state);
    };

    syncLightSwitch();
    syncLightingSwitch();
    syncColorSwitch();
    syncTransparencySwitch();
    syncSpecularUi();
    syncCameraSwitch();
    syncHotspotSwitch();
    syncSectionsUi();

    fullscreenEvents.forEach((eventName) => {
      document.addEventListener(eventName as unknown as keyof DocumentEventMap, handleFullscreenChange as EventListener);
    });

    handleFullscreenChange();

        window.actionsToolbar = toolbarHandler;

        if (typeof window.init3dhop === 'function') {
          window.init3dhop();
        }

        const presenter = new window.Presenter('draw-canvas');
        presenterRef.current = presenter;
        window.presenter = presenter;
        setPresenterState(presenter);

        applyScene(presenter);

        const initialTrackball = presenter.getTrackballPosition?.();
        if (Array.isArray(initialTrackball)) {
          notifyTrackballObservers(initialTrackball);
        }

        previousOnEndMeasurementRef.current = presenter._onEndMeasurement;
        previousOnEndPickingPointRef.current = presenter._onEndPickingPoint;

        presenter._onEndMeasurement = (measure: number) => {
          setMeasurementValue(measure);
        };

        presenter._onEndPickingPoint = (point: number[]) => {
          if (!Array.isArray(point) || point.length < 3) {
            return;
          }
          const [x, y, z] = point;
          setPickpointValue([
            x + resolvedCoordinateCorrections.x,
            y + resolvedCoordinateCorrections.y,
            z + resolvedCoordinateCorrections.z
          ]);
        };

        const previousPickHandler = presenter._onPickedSpot;
        previousOnPickedSpotRef.current = previousPickHandler;

        presenter._onPickedSpot = (id: string) => {
          const annotation = annotationDefinitionsRef.current.get(id);
          if (annotation) {
            dispatchAnnotationPick({ id, annotation });
          }
          if (typeof previousPickHandler === 'function') {
            previousPickHandler(id);
          }
        };
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize 3DHOP viewer', error);
      }
    };

    setup();

    return () => {
      disposed = true;

      const presenter = presenterRef.current;

      if (presenter) {
        if (typeof previousOnEndMeasurementRef.current !== 'undefined') {
          presenter._onEndMeasurement = previousOnEndMeasurementRef.current;
          previousOnEndMeasurementRef.current = undefined;
        }

        if (typeof previousOnEndPickingPointRef.current !== 'undefined') {
          presenter._onEndPickingPoint = previousOnEndPickingPointRef.current;
          previousOnEndPickingPointRef.current = undefined;
        }

        if (typeof previousOnPickedSpotRef.current !== 'undefined') {
          presenter._onPickedSpot = previousOnPickedSpotRef.current;
          previousOnPickedSpotRef.current = undefined;
        }

        if (typeof presenter.destroy === 'function') {
          presenter.destroy();
        }
      }

      if (window.actionsToolbar === toolbarHandler) {
        window.actionsToolbar = previousActionsRef.current;
      }

      if (window.presenter === presenter) {
        window.presenter = previousPresenterRef.current ?? null;
      }

      if (window.onTrackballUpdate === trackballUpdateHandler) {
        window.onTrackballUpdate = previousOnTrackballUpdateRef.current;
      }
      previousOnTrackballUpdateRef.current = undefined;

      if (window.measureSwitch === syncMeasurementUi) {
        window.measureSwitch = previousMeasureSwitchRef.current;
      }

      if (window.pickpointSwitch === syncPickpointUi) {
        window.pickpointSwitch = previousPickpointSwitchRef.current;
      }

      if (window.sectiontoolSwitch === sectiontoolSwitchProxy) {
        window.sectiontoolSwitch = previousSectiontoolSwitchRef.current;
      }

      window.lightSwitch = previousLightSwitchRef.current;
      window.lightingSwitch = previousLightingSwitchRef.current;
      window.colorSwitch = previousColorSwitchRef.current;
      window.cameraSwitch = previousCameraSwitchRef.current;
  window.transparencySwitch = previousTransparencySwitchRef.current;
  window.specularSwitch = previousSpecularSwitchRef.current;
      window.hotspotSwitch = previousHotspotSwitchRef.current;

      fullscreenEvents.forEach((eventName) => {
        document.removeEventListener(eventName as unknown as keyof DocumentEventMap, handleFullscreenChange as EventListener);
      });

      trackballObserversRef.current.clear();
      annotationHandlersRef.current.clear();
      annotationDefinitionsRef.current.clear();

      presenterRef.current = null;
      setPresenterState(null);
      resetActiveTool();
    };
    // `assetBaseUrl` and `resolvedModelUrl` are captured intentionally for first render only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      registerSceneObserver={registerSceneObserver}
      registerTrackballObserver={registerTrackballObserver}
      registerAnnotationHandler={registerAnnotationHandler}
      hasHotspotContribution={hasHotspotContribution}
      measurementUnits={measurementUnitLabel}
      measurementValue={measurementValue}
      pickpointValue={pickpointValue}
      setMeasurementValue={setMeasurementValue}
      setPickpointValue={setPickpointValue}
      coordinateCorrections={resolvedCoordinateCorrections}
    >
      <div
        className={className}
        style={{
          position: 'relative',
          width,
          height,
          overflow: 'hidden',
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
            <ToolbarAssetsProvider assetBaseUrl={normalizedBaseUrl}>
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
            </ToolbarAssetsProvider>
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
    </ThreeDHopViewerProvider>
  );
};
