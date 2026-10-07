import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ensureAssets } from './assets.js';
import { getHopAllTag } from '../utils/hopTags.js';
import type { InteractiveTool, InteractiveToolPickContext } from './interactiveTools.js';
import type {
  AnnotationPickEvent,
  AnnotationPickHandler,
  CoordinateCorrections,
  PresenterInstance,
  TrackballObserver,
  Vector3
} from './types.js';
import type { AnnotationDefinition } from '../utils/annotations.js';

/**
 * presenterLifecycle.ts centralises the imperative 3DHOP presenter boot process.
 *
 * The hook exported here is responsible for:
 * - ensuring the legacy asset bundle is ready before the viewer renders;
 * - wiring all global window callbacks that 3DHOP uses for toolbar interactions;
 * - instantiating the presenter and exposing its React-friendly state;
 * - resetting every overridden callback during unmount so host apps stay clean.
 *
 * Downstream components can therefore focus on declarative concerns (layout,
 * listeners, context providers) while this module owns the tricky side-effects.
 */

export type PresenterLifecycleOptions = {
  presenterRef: React.MutableRefObject<PresenterInstance | null>;
  normalizedBaseUrl: string;
  applyScene: (presenter: PresenterInstance, preserveView?: boolean) => void;
  notifyTrackballObservers: (trackState: number[]) => void;
  notifySceneReadyObservers: (presenter: PresenterInstance) => void;
  notifyLightObservers: (direction: Vector3) => void;
  dispatchToolbarAction: (action: string, presenter: PresenterInstance) => boolean;
  toggleTool: (toolId: InteractiveTool, presenter: PresenterInstance) => void;
  hasTool: (toolId: InteractiveTool) => boolean;
  dispatchPick: (context: InteractiveToolPickContext) => void;
  toggleInfoVisibility: () => void;
  isControlVisible: (controlId: string) => boolean | null;
  syncFullscreenUi: (isFullscreen: boolean) => void;
  syncMeasurementUi: (override?: boolean) => void;
  syncPickpointUi: (override?: boolean) => void;
  syncSectionsUi: () => void;
  syncLightSwitch: (override?: boolean) => boolean;
  syncLightingSwitch: (override?: boolean) => boolean;
  syncColorSwitch: (override?: boolean) => boolean;
  syncTransparencySwitch: (override?: boolean) => boolean;
  syncSpecularUi: (override?: boolean) => boolean;
  syncCameraSwitch: (override?: boolean) => boolean;
  syncHotspotSwitch: (override?: boolean) => boolean;
  setMeasurementValue: React.Dispatch<React.SetStateAction<number | null>>;
  /** Only set when a measurement completes (the second pick); see `restoreMeasurement`. */
  setMeasurementPoints: React.Dispatch<React.SetStateAction<[Vector3, Vector3] | null>>;
  resolvedCoordinateCorrections: Required<CoordinateCorrections>;
  dispatchAnnotationPick: (event: AnnotationPickEvent) => void;
  annotationDefinitionsRef: React.MutableRefObject<Map<string, AnnotationDefinition>>;
  annotationHandlersRef: React.MutableRefObject<Set<AnnotationPickHandler>>;
  trackballObserversRef: React.MutableRefObject<Set<TrackballObserver>>;
  resetActiveTool: () => void;
  reassertActiveTool: (presenter?: PresenterInstance | null) => void;
};

export type PresenterLifecycleResult = {
  presenterState: PresenterInstance | null;
  /** Stable reference to the latest `toolbarHandler`; see `triggerToolbarAction` below. */
  triggerToolbarAction: (action: string) => void;
};

/**
 * Bootstraps the 3DHOP presenter, binding the toolbar, wiring window callbacks,
 * and returning the live presenter instance for React consumers. All temporary
 * overrides are reverted automatically when the host component unmounts.
 */
export function usePresenterLifecycle({
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
}: PresenterLifecycleOptions): PresenterLifecycleResult {
  const previousActionsRef = useRef<typeof window.actionsToolbar>();
  const previousPresenterRef = useRef<typeof window.presenter>();
  const previousOnTrackballUpdateRef = useRef<typeof window.onTrackballUpdate>();
  const previousMeasureSwitchRef = useRef<typeof window.measureSwitch>();
  const previousPickpointSwitchRef = useRef<typeof window.pickpointSwitch>();
  const previousSectiontoolSwitchRef = useRef<typeof window.sectiontoolSwitch>();
  const previousLightSwitchRef = useRef<typeof window.lightSwitch>();
  const previousLightingSwitchRef = useRef<typeof window.lightingSwitch>();
  const previousCameraSwitchRef = useRef<typeof window.cameraSwitch>();
  const previousColorSwitchRef = useRef<typeof window.colorSwitch>();
  const previousTransparencySwitchRef = useRef<typeof window.transparencySwitch>();
  const previousSpecularSwitchRef = useRef<typeof window.specularSwitch>();
  const previousHotspotSwitchRef = useRef<typeof window.hotspotSwitch>();
  const previousOnEndMeasurementRef = useRef<PresenterInstance['_onEndMeasurement']>();
  const previousOnEndPickingPointRef = useRef<PresenterInstance['_onEndPickingPoint']>();
  const previousOnPickedSpotRef = useRef<PresenterInstance['_onPickedSpot']>();
  const previousTestReadyRef = useRef<PresenterInstance['_testReady']>();
  const previousSetSceneRef = useRef<PresenterInstance['setScene']>();
  const previousRotateLightRef = useRef<PresenterInstance['rotateLight']>();
  const previousResetTrackballRef = useRef<PresenterInstance['resetTrackball']>();
  /** Captures the current effect run's `toolbarHandler` so `triggerToolbarAction` stays callable
   * across re-runs without itself being a dependency of the setup effect below. */
  const toolbarHandlerRef = useRef<(action: string) => void>();

  const [presenterState, setPresenterState] = useState<PresenterInstance | null>(null);

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
          if (
            typeof presenter.enableSceneLighting === 'function' &&
            typeof presenter.isSceneLightingEnabled === 'function'
          ) {
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
        default: {
          // Any registered tool can be driven by a toolbar image whose id is the tool id
          // (optionally with 3DHOP's `_on` suffix).
          const toolId = action.replace(/_on$/, '');
          if (hasTool(toolId)) {
            toggleTool(toolId, presenter);
          }
          break;
        }
      }
    };

    toolbarHandlerRef.current = toolbarHandler;

    const fullscreenEvents = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ] as const;

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
          document.addEventListener(
            eventName as unknown as keyof DocumentEventMap,
            handleFullscreenChange as EventListener
          );
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

        // Scene-ready: 3DHOP calls `_testReady` as each object finishes loading; it flips
        // `_sceneReady` once the count reaches zero. Observe that transition per scene apply.
        if (typeof presenter._testReady === 'function') {
          const originalTestReady = presenter._testReady;
          previousTestReadyRef.current = originalTestReady;
          let announcedReady = false;
          const originalSetScene = presenter.setScene;
          previousSetSceneRef.current = originalSetScene;
          presenter.setScene = function wrappedSetScene(scene: unknown) {
            announcedReady = false;
            const result = originalSetScene.call(presenter, scene);
            // 3DHOP's setScene resets its measurement/pick-point flags; keep the active tool on.
            reassertActiveTool(presenter);
            return result;
          };
          presenter._testReady = function wrappedTestReady() {
            originalTestReady.call(presenter);
            if (!announcedReady && presenter._isSceneReady?.()) {
              announcedReady = true;
              notifySceneReadyObservers(presenter);
            }
          };
        }

        // Light direction: `rotateLight` is the only setter; `resetTrackball` restores the default.
        const emitLight = () => {
          const direction = presenter._lightDirection;
          if (Array.isArray(direction) && direction.length >= 3) {
            notifyLightObservers([direction[0], direction[1], direction[2]]);
          }
        };
        if (typeof presenter.rotateLight === 'function') {
          const originalRotateLight = presenter.rotateLight;
          previousRotateLightRef.current = originalRotateLight;
          presenter.rotateLight = function wrappedRotateLight(x: number, y: number) {
            originalRotateLight.call(presenter, x, y);
            emitLight();
          };
        }
        {
          const originalResetTrackball = presenter.resetTrackball;
          previousResetTrackballRef.current = originalResetTrackball;
          presenter.resetTrackball = function wrappedResetTrackball() {
            originalResetTrackball.call(presenter);
            emitLight();
          };
        }

        applyScene(presenter);

        const initialTrackball = presenter.getTrackballPosition?.();
        if (Array.isArray(initialTrackball)) {
          notifyTrackballObservers(initialTrackball);
        }

        previousOnEndMeasurementRef.current = presenter._onEndMeasurement;
        previousOnEndPickingPointRef.current = presenter._onEndPickingPoint;

        presenter._onEndMeasurement = (measure: number, pointA?: Vector3, pointB?: Vector3) => {
          setMeasurementValue(measure);
          if (pointA && pointB) {
            setMeasurementPoints([pointA, pointB]);
          }
        };

        presenter._onEndPickingPoint = (point: number[]) => {
          if (!Array.isArray(point) || point.length < 3) {
            return;
          }
          const [x, y, z] = point;
          dispatchPick({
            raw: [x, y, z],
            corrected: [
              x + resolvedCoordinateCorrections.x,
              y + resolvedCoordinateCorrections.y,
              z + resolvedCoordinateCorrections.z
            ],
            presenter
          });
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

    void setup();

    return () => {
      disposed = true;

      const presenter = presenterRef.current;

      if (presenter) {
        if (typeof previousTestReadyRef.current !== 'undefined') {
          presenter._testReady = previousTestReadyRef.current;
          previousTestReadyRef.current = undefined;
        }

        if (typeof previousSetSceneRef.current !== 'undefined') {
          presenter.setScene = previousSetSceneRef.current;
          previousSetSceneRef.current = undefined;
        }

        if (typeof previousRotateLightRef.current !== 'undefined') {
          presenter.rotateLight = previousRotateLightRef.current;
          previousRotateLightRef.current = undefined;
        }

        if (typeof previousResetTrackballRef.current !== 'undefined') {
          presenter.resetTrackball = previousResetTrackballRef.current;
          previousResetTrackballRef.current = undefined;
        }

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
        document.removeEventListener(
          eventName as unknown as keyof DocumentEventMap,
          handleFullscreenChange as EventListener
        );
      });

      trackballObserversRef.current.clear();
      annotationHandlersRef.current.clear();
      annotationDefinitionsRef.current.clear();

      presenterRef.current = null;
      setPresenterState(null);
      resetActiveTool();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerToolbarAction = useCallback((action: string) => {
    toolbarHandlerRef.current?.(action);
  }, []);

  return { presenterState, triggerToolbarAction };
}
