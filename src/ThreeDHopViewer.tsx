import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  isAbsoluteAssetUrl,
  joinAssetPath,
  resolveRelativeAssetPath
} from './utils/assetPaths';
import { getHopAllTag } from './utils/hopTags';

const CSS_RESOURCES = ['stylesheet/3dhop.css'];

const SCRIPT_RESOURCES = [
  'js/spidergl.js',
  'js/jquery.js',
  'js/presenter.js',
  'js/nexus.js',
  'js/ply.js',
  'js/trackball_turntable.js',
  'js/trackball_turntable_pan.js',
  'js/trackball_pantilt.js',
  'js/trackball_sphere.js',
  'js/init.js'
];

const cssPromises = new Map<string, Promise<void>>();
const scriptPromises = new Map<string, Promise<void>>();

export type PresenterInstance = {
  setScene: (scene: unknown) => void;
  resetTrackball: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  enableLightTrackball: (enabled: boolean) => void;
  isLightTrackballEnabled: () => boolean;
  enableSceneLighting?: (enabled: boolean) => void;
  isSceneLightingEnabled?: () => boolean;
  toggleCameraType?: () => void;
  toggleInstanceSolidColor?: (target: unknown, updateUi?: boolean) => void;
  enableMeasurementTool?: (enabled: boolean) => void;
  isMeasurementToolEnabled?: () => boolean;
  enablePickpointMode?: (enabled: boolean) => void;
  isPickpointModeEnabled?: () => boolean;
  toggleSpotVisibility?: (tag: unknown, redraw?: boolean) => void;
  setSpotVisibility?: (tag: unknown, visible: boolean, redraw?: boolean) => void;
  isSpotVisibilityEnabled?: (tag?: unknown) => boolean;
  enableOnHover?: (enabled: boolean) => void;
  isOnHoverEnabled?: () => boolean;
  isAnyMeasurementEnabled?: () => boolean;
  getTrackballPosition?: () => number[];
  setTrackballPosition?: (state: number[]) => void;
  saveScreenshot?: () => void;
  _onEndMeasurement?: (measure: number) => void;
  _onEndPickingPoint?: (point: number[]) => void;
  _onPickedSpot?: (id: string) => void;
  destroy?: () => void;
  ui?: {
    postDrawEvent?: () => void;
  };
} & Record<string, unknown>;

type SceneMeshes = Record<string, { url: string }>;

export type SceneContribution = {
  meshes?: SceneMeshes;
  spots?: Record<string, unknown>;
};

export type ToolbarActionHandler = (presenter: PresenterInstance, action: string) => boolean | void;
export type SceneObserver = (presenter: PresenterInstance) => void;

export type CoordinateCorrections = {
  x?: number;
  y?: number;
  z?: number;
};

export type ThreeDHopViewerContextValue = {
  presenter: PresenterInstance | null;
  assetBaseUrl: string;
  registerSceneContribution: (key: string, contribution: SceneContribution | null) => () => void;
  registerToolbarAction: (actions: string | string[], handler: ToolbarActionHandler) => () => void;
  registerSceneObserver: (observer: SceneObserver) => () => void;
  hasHotspotContribution: boolean;
  measurementUnits: string;
  measurementValue: number | null;
  pickpointValue: [number, number, number] | null;
  setMeasurementValue: React.Dispatch<React.SetStateAction<number | null>>;
  setPickpointValue: React.Dispatch<React.SetStateAction<[number, number, number] | null>>;
  coordinateCorrections: Required<CoordinateCorrections>;
};

const ThreeDHopViewerContext = createContext<ThreeDHopViewerContextValue | null>(null);

export const useThreeDHopViewer = (): ThreeDHopViewerContextValue => {
  const context = useContext(ThreeDHopViewerContext);
  if (!context) {
    throw new Error('useThreeDHopViewer must be used within a ThreeDHopViewer');
  }
  return context;
};

declare global {
  interface Window {
    Presenter: new (canvasId: string) => PresenterInstance;
    TurnTableTrackball: unknown;
    init3dhop?: () => void;
    lightSwitch?: (on?: boolean) => void;
    lightingSwitch?: (on?: boolean) => void;
    cameraSwitch?: (on?: boolean) => void;
    colorSwitch?: (on?: boolean) => void;
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
  }
  const HOP_ALL: unknown;
}

export type ThreeDHopViewerProps = {
  assetBaseUrl?: string;
  modelUrl?: string;
  backgroundUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
  showToolbar?: boolean;
  measurementUnits?: string;
  coordinateCorrections?: CoordinateCorrections;
  children?: React.ReactNode;
};

type InteractiveTool = 'measure' | 'pick';

type InteractiveToolConfig = {
  id: InteractiveTool;
  enable?: (presenter: PresenterInstance, enabled: boolean) => void;
  isEnabled?: (presenter: PresenterInstance) => boolean | undefined;
  syncUi: (enabled?: boolean) => void;
};

type SceneConfiguration = {
  meshes: SceneMeshes;
  modelInstances: Record<string, { mesh: string }>;
  trackball: {
    type: unknown;
    trackOptions: {
      startPhi: number;
      startTheta: number;
      startDistance: number;
      minMaxPhi: [number, number];
      minMaxTheta: [number, number];
      minMaxDist: [number, number];
    };
  };
  spots?: Record<string, unknown>;
};

function loadCssOnce(href: string): Promise<void> {
  if (cssPromises.has(href)) {
    return cssPromises.get(href)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`link[data-3dhop-source="${href}"]`)) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-3dhop-source', href);
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });

  cssPromises.set(href, promise);
  return promise;
}

function loadScriptOnce(src: string): Promise<void> {
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-3dhop-source="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    script.async = false;
    script.setAttribute('data-3dhop-source', src);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

async function ensureAssets(baseUrl: string): Promise<void> {
  await Promise.all(CSS_RESOURCES.map((file) => loadCssOnce(`${baseUrl}/${file}`)));
  for (const file of SCRIPT_RESOURCES) {
    // Sequential load keeps execution order identical to the static HTML bootstrap.
    // eslint-disable-next-line no-await-in-loop
    await loadScriptOnce(`${baseUrl}/${file}`);
  }
}

function resolveBackgroundUrl(provided: string | null | undefined, baseUrl: string): string | null {
  const fallback = joinAssetPath(baseUrl, 'skins/backgrounds/light.jpg');
  if (provided === null) return null;
  if (provided === undefined) return fallback;
  if (isAbsoluteAssetUrl(provided)) {
    return provided;
  }
  const sanitized = provided.replace(/^\/+/, '');
  if (!sanitized) {
    return fallback;
  }
  return joinAssetPath(baseUrl, sanitized);
}

export const ThreeDHopViewer: React.FC<ThreeDHopViewerProps> = ({
  assetBaseUrl = '/node_modules/react-3dhop/dist/3dhop',
  modelUrl,
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
  const [presenterState, setPresenterState] = useState<PresenterInstance | null>(null);
  const sceneContributionsRef = useRef<Map<string, SceneContribution>>(new Map());
  const [sceneContributionsVersion, setSceneContributionsVersion] = useState(0);
  const toolbarHandlersRef = useRef<Map<string, Set<ToolbarActionHandler>>>(new Map());
  const sceneObserversRef = useRef<Set<SceneObserver>>(new Set());
  const [hasHotspotContribution, setHasHotspotContribution] = useState(false);
  const [measurementValue, setMeasurementValue] = useState<number | null>(null);
  const [pickpointValue, setPickpointValue] = useState<[number, number, number] | null>(null);
  const [activeInteractiveTool, setActiveInteractiveTool] = useState<InteractiveTool | null>(null);
  const activeInteractiveToolRef = useRef<InteractiveTool | null>(null);

  useEffect(() => {
    activeInteractiveToolRef.current = activeInteractiveTool;
  }, [activeInteractiveTool]);

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

  const clearSelectionRange = useCallback(() => {
    const selection = window.getSelection?.();
    if (selection && selection.toString() !== '') {
      selection.removeAllRanges();
      return;
    }

    const legacySelection = (document as Document & {
      selection?: {
        empty?: () => void;
      };
    }).selection;

    legacySelection?.empty?.();
  }, []);

  const syncMeasurementUi = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const shouldEnable =
        typeof override === 'boolean'
          ? override
          : presenter?.isMeasurementToolEnabled?.() ?? activeInteractiveToolRef.current === 'measure';

      const measure = document.getElementById('measure');
      const measureOn = document.getElementById('measure_on');
      const box = document.getElementById('measure-box');
      const canvas = document.getElementById('draw-canvas') as HTMLCanvasElement | null;

      if (shouldEnable) {
        if (measure) measure.style.visibility = 'hidden';
        if (measureOn) measureOn.style.visibility = 'visible';
        if (box) box.style.display = 'table';
        if (canvas) canvas.style.cursor = 'crosshair';
      } else {
        clearSelectionRange();
        if (measureOn) measureOn.style.visibility = 'hidden';
        if (measure) measure.style.visibility = 'visible';
        if (box) box.style.display = 'none';
        const anyMeasurementEnabled = presenter?.isAnyMeasurementEnabled?.() ?? false;
        if (canvas && !anyMeasurementEnabled) {
          canvas.style.cursor = 'default';
        }
        setMeasurementValue(null);
      }

    },
    [clearSelectionRange]
  );

  const syncPickpointUi = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const shouldEnable =
        typeof override === 'boolean'
          ? override
          : presenter?.isPickpointModeEnabled?.() ?? activeInteractiveToolRef.current === 'pick';

      const pick = document.getElementById('pick');
      const pickOn = document.getElementById('pick_on');
      const box = document.getElementById('pickpoint-box');
      const canvas = document.getElementById('draw-canvas') as HTMLCanvasElement | null;

      if (shouldEnable) {
        if (pick) pick.style.visibility = 'hidden';
        if (pickOn) pickOn.style.visibility = 'visible';
        if (box) box.style.display = 'table';
        if (canvas) canvas.style.cursor = 'crosshair';
      } else {
        clearSelectionRange();
        if (pickOn) pickOn.style.visibility = 'hidden';
        if (pick) pick.style.visibility = 'visible';
        if (box) box.style.display = 'none';
        const anyMeasurementEnabled = presenter?.isAnyMeasurementEnabled?.() ?? false;
        if (canvas && !anyMeasurementEnabled) {
          canvas.style.cursor = 'default';
        }
        setPickpointValue(null);
      }

    },
    [clearSelectionRange]
  );

  const interactiveToolConfigs = useMemo(() => {
    const configs: Map<InteractiveTool, InteractiveToolConfig> = new Map();

    configs.set('measure', {
      id: 'measure',
      enable: (presenter, enabled) => presenter.enableMeasurementTool?.(enabled),
      isEnabled: (presenter) => presenter.isMeasurementToolEnabled?.(),
      syncUi: syncMeasurementUi
    });

    configs.set('pick', {
      id: 'pick',
      enable: (presenter, enabled) => presenter.enablePickpointMode?.(enabled),
      isEnabled: (presenter) => presenter.isPickpointModeEnabled?.(),
      syncUi: syncPickpointUi
    });

    return configs;
  }, [syncMeasurementUi, syncPickpointUi]);

  const deactivateTool = useCallback(
    (toolId: InteractiveTool, presenter: PresenterInstance) => {
      const config = interactiveToolConfigs.get(toolId);
      if (!config || typeof config.enable !== 'function') {
        return false;
      }

      const isActive =
        typeof config.isEnabled === 'function'
          ? Boolean(config.isEnabled(presenter))
          : activeInteractiveToolRef.current === toolId;

      if (!isActive) {
        return false;
      }

      config.enable(presenter, false);
      config.syncUi(false);
      setActiveInteractiveTool((current) => (current === toolId ? null : current));
      activeInteractiveToolRef.current = null;
      return true;
    },
    [interactiveToolConfigs]
  );

  const toggleTool = useCallback(
    (toolId: InteractiveTool, presenter: PresenterInstance) => {
      const config = interactiveToolConfigs.get(toolId);
      if (!config || typeof config.enable !== 'function') {
        return;
      }

      const currentlyEnabled =
        typeof config.isEnabled === 'function'
          ? Boolean(config.isEnabled(presenter))
          : activeInteractiveToolRef.current === toolId;
      const nextEnabled = !currentlyEnabled;

      if (nextEnabled) {
        if (activeInteractiveToolRef.current && activeInteractiveToolRef.current !== toolId) {
          deactivateTool(activeInteractiveToolRef.current, presenter);
        }

        config.enable(presenter, true);
        config.syncUi(true);
        setActiveInteractiveTool(toolId);
        activeInteractiveToolRef.current = toolId;
      } else {
        void deactivateTool(toolId, presenter);
      }
    },
    [deactivateTool, interactiveToolConfigs]
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

  const buildSceneOptions = useCallback((): SceneConfiguration => {
    const meshes: SceneMeshes = {
      mesh_1: { url: resolvedModelUrl }
    };

    const scene: SceneConfiguration = {
      meshes,
      modelInstances: {
        model_1: { mesh: 'mesh_1' }
      },
      trackball: {
        type: window.TurnTableTrackball,
        trackOptions: {
          startPhi: 35.0,
          startTheta: 15.0,
          startDistance: 2.5,
          minMaxPhi: [-180, 180],
          minMaxTheta: [-30.0, 70.0],
          minMaxDist: [0.5, 3.0]
        }
      }
    };

    sceneContributionsRef.current.forEach((contribution) => {
      if (contribution.meshes) {
        Object.assign(meshes, contribution.meshes);
      }
      if (contribution.spots) {
        scene.spots = {
          ...(scene.spots ?? {}),
          ...contribution.spots
        };
      }
    });

    return scene;
  }, [resolvedModelUrl, sceneContributionsVersion]);

  const applyScene = useCallback(
    (presenter: PresenterInstance, preserveView = false) => {
      let trackballState: number[] | undefined;

      if (preserveView && typeof presenter.getTrackballPosition === 'function') {
        trackballState = presenter.getTrackballPosition();
      }

      const sceneOptions = buildSceneOptions();
      presenter.setScene(sceneOptions);

      if (trackballState && typeof presenter.setTrackballPosition === 'function') {
        presenter.setTrackballPosition(trackballState);
      }

      const hasHotspots = Boolean(sceneOptions.spots && Object.keys(sceneOptions.spots).length > 0);
      setHasHotspotContribution(hasHotspots);

      sceneObserversRef.current.forEach((observer) => observer(presenter));

      if (document.getElementById('sections-box')) {
        window.sectiontoolInit?.();
        window.sectiontoolReset?.();
      }
    },
    [buildSceneOptions]
  );

  useEffect(() => {
    let disposed = false;

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
        default:
          break;
      }
    };

    const setup = async () => {
      try {
        previousActionsRef.current = window.actionsToolbar;
        previousPresenterRef.current = window.presenter;

    await ensureAssets(normalizedBaseUrl);
    if (disposed) return;

    previousMeasureSwitchRef.current = window.measureSwitch;
    previousPickpointSwitchRef.current = window.pickpointSwitch;
    window.measureSwitch = syncMeasurementUi;
    window.pickpointSwitch = syncPickpointUi;

        window.actionsToolbar = toolbarHandler;

        if (typeof window.init3dhop === 'function') {
          window.init3dhop();
        }

        const presenter = new window.Presenter('draw-canvas');
        presenterRef.current = presenter;
        window.presenter = presenter;
        setPresenterState(presenter);

        applyScene(presenter);

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

        if (document.getElementById('sections-box')) {
          window.sectiontoolInit?.();
          window.sectiontoolReset?.();
        }
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

      if (window.measureSwitch === syncMeasurementUi) {
        window.measureSwitch = previousMeasureSwitchRef.current;
      }

      if (window.pickpointSwitch === syncPickpointUi) {
        window.pickpointSwitch = previousPickpointSwitchRef.current;
      }

      presenterRef.current = null;
      setPresenterState(null);
      setActiveInteractiveTool(null);
      activeInteractiveToolRef.current = null;
    };
    // `assetBaseUrl` and `resolvedModelUrl` are captured intentionally for first render only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const presenter = presenterRef.current;
    if (!presenter) {
      return;
    }

    applyScene(presenter, true);
  }, [applyScene]);

  const contextValue = useMemo<ThreeDHopViewerContextValue>(
    () => ({
      presenter: presenterState,
      assetBaseUrl: normalizedBaseUrl,
      registerSceneContribution,
      registerToolbarAction,
      registerSceneObserver,
      hasHotspotContribution,
      measurementUnits: measurementUnitLabel,
      measurementValue,
      pickpointValue,
      setMeasurementValue,
      setPickpointValue,
      coordinateCorrections: resolvedCoordinateCorrections
    }),
    [
      normalizedBaseUrl,
      presenterState,
      registerSceneContribution,
      registerToolbarAction,
      registerSceneObserver,
      hasHotspotContribution,
      measurementUnitLabel,
      measurementValue,
      pickpointValue,
      setMeasurementValue,
      setPickpointValue,
      resolvedCoordinateCorrections
    ]
  );

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

  return (
    <ThreeDHopViewerContext.Provider value={contextValue}>
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
              {hasProvidedToolbar ? (
                toolbarChildren
              ) : (
                <Toolbar>
                  <HomeControl />
                  <ZoomInControl />
                  <ZoomOutControl />
                  <LightControl />
                  {hasHotspotContribution ? <HotspotControl /> : null}
                  <FullscreenControl />
                </Toolbar>
              )}
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
    </ThreeDHopViewerContext.Provider>
  );
};
