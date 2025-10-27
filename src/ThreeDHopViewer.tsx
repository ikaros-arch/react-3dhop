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
import { buildAnnotations, type AnnotationDefinition } from './utils/annotations';

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
  setInstanceTransparency?: (tag: unknown, newState: boolean, redraw?: boolean, newAlpha?: number) => void;
  isInstanceTransparencyEnabled?: (tag?: unknown) => boolean;
  setInstanceSpecularity?: (tag: unknown, color: [number, number, number], hardness: number, redraw?: boolean) => void;
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
  animateToTrackballPosition?: (newPosition: number[], newTime?: number) => void;
  _onEndMeasurement?: (measure: number) => void;
  _onEndPickingPoint?: (point: number[]) => void;
  _onPickedSpot?: (id: string) => void;
  destroy?: () => void;
  repaint?: () => void;
  ui?: {
    postDrawEvent?: () => void;
  };
  _scene?: {
    modelInstances?: Record<string, {
      useTransparency?: boolean;
      specularColor?: number[];
    }>;
  };
} & Record<string, unknown>;

type SceneMeshDefinition = {
  url: string;
  renderMode?: string[];
  mType?: 'nexus' | 'ply';
};

type SceneMeshes = Record<string, SceneMeshDefinition>;

export type ModelTransformConfig = {
  translation?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  matrix?: number[];
};

type ModelInstanceConfiguration = {
  mesh: string;
  transform?: ModelTransformConfig;
  tags?: string[];
  visible?: boolean;
  color?: [number, number, number];
  backfaceColor?: [number, number, number, number];
  specularColor?: [number, number, number, number];
  alpha?: number;
  useTransparency?: boolean;
  useLighting?: boolean;
  useSolidColor?: boolean;
  [key: string]: unknown;
};

export type ModelTransparencyOptions = {
  enabled?: boolean;
  alpha?: number;
};

export type ModelDefinition = {
  url?: string;
  meshId?: string;
  instanceId?: string;
  transform?: ModelTransformConfig;
  scale?: number | [number, number, number];
  color?: [number, number, number];
  backfaceColor?: [number, number, number, number];
  specularColor?: [number, number, number, number];
  tags?: string[];
  visible?: boolean;
  useSolidColor?: boolean;
  transparency?: boolean | ModelTransparencyOptions;
  alpha?: number;
  annotations?: AnnotationDefinition[];
  annotationMeshUrl?: string;
  instance?: Omit<ModelInstanceConfiguration, 'mesh'>;
};

export type SceneContribution = {
  meshes?: SceneMeshes;
  modelInstances?: Record<string, ModelInstanceConfiguration>;
  spots?: Record<string, unknown>;
  annotations?: Record<string, AnnotationDefinition>;
};

export type ToolbarActionHandler = (presenter: PresenterInstance, action: string) => boolean | void;
export type SceneObserver = (presenter: PresenterInstance) => void;
export type TrackballObserver = (trackState: number[]) => void;

export type AnnotationPickEvent = {
  id: string;
  annotation: AnnotationDefinition;
};

export type AnnotationPickHandler = (event: AnnotationPickEvent) => void;

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
  registerTrackballObserver: (observer: TrackballObserver) => () => void;
  registerAnnotationHandler: (handler: AnnotationPickHandler) => () => void;
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

export type ThreeDHopViewerProps = {
  assetBaseUrl?: string;
  modelUrl?: string;
  models?: Record<string, ModelDefinition | null | undefined>;
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
  modelInstances: Record<string, ModelInstanceConfiguration>;
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

function sanitizeIdentifier(value: string, fallback: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized.length > 0 ? sanitized : fallback;
}

function ensureUniqueName(base: string, used: Set<string>): string {
  let candidate = base;
  let index = 1;
  while (used.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function normalizeScale(scale?: number | [number, number, number]): [number, number, number] | undefined {
  if (scale == null) {
    return undefined;
  }

  if (typeof scale === 'number') {
    const numeric = Number(scale);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }
    return [numeric, numeric, numeric];
  }

  if (Array.isArray(scale) && scale.length >= 3) {
    const values: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 3; i += 1) {
      const numeric = Number(scale[i]);
      values[i] = Number.isFinite(numeric) ? numeric : 1;
    }
    return values;
  }

  return undefined;
}

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

function queryToolbarElements<T extends HTMLElement = HTMLElement>(dataId: string): T[] {
  if (typeof document === 'undefined') {
    return [];
  }
  return Array.from(document.querySelectorAll<T>(`[data-hop-id="${dataId}"]`));
}

function queryToolbarSidecars<T extends HTMLElement = HTMLElement>(dataId: string): T[] {
  if (typeof document === 'undefined') {
    return [];
  }
  return Array.from(document.querySelectorAll<T>(`[data-hop-sidecar="${dataId}"]`));
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
  const infoBoxVisibleRef = useRef(false);
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
  const [activeInteractiveTool, setActiveInteractiveTool] = useState<InteractiveTool | null>(null);
  const activeInteractiveToolRef = useRef<InteractiveTool | null>(null);

  useEffect(() => {
    activeInteractiveToolRef.current = activeInteractiveTool;
  }, [activeInteractiveTool]);

  const alignToolbarSidecars = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const container = document.querySelector<HTMLElement>('[data-hop-toolbar-container="true"]');
    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const containerMidX = containerRect.left + containerRect.width / 2;
    const toolbars = Array.from(container.querySelectorAll<HTMLElement>('[data-hop-toolbar]'));

    toolbars.forEach((toolbar) => {
      const toolbarId = toolbar.getAttribute('data-hop-toolbar');
      if (!toolbarId) {
        return;
      }

      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarCenterX = toolbarRect.left + toolbarRect.width / 2;
      const isRightAligned = toolbarCenterX >= containerMidX;

      const anchorMap: Record<string, string[]> = {
        'measure-box': ['measure', 'measure_on'],
        'pickpoint-box': ['pick', 'pick_on'],
        'sections-box': ['sections', 'sections_on'],
        'info-box': ['info', 'info_on']
      };

      Object.entries(anchorMap).forEach(([sidecarId, anchorIds]) => {
        const sidecar = container.querySelector<HTMLElement>(
          `[data-hop-sidecar="${sidecarId}"][data-hop-toolbar-owner="${toolbarId}"]`
        );
        if (!sidecar) {
          return;
        }

        const anchor = anchorIds
          .map((candidate) => toolbar.querySelector<HTMLElement>(`[data-hop-id="${candidate}"]`))
          .find((element): element is HTMLElement => Boolean(element));
        if (!anchor) {
          return;
        }

    const anchorRect = anchor.getBoundingClientRect();
    const anchorTop = anchorRect.top - containerRect.top;
    const anchorRight = anchorRect.right - containerRect.left;

        sidecar.style.left = 'auto';
        sidecar.style.right = 'auto';

        if (isRightAligned) {
          const rightOffset = containerRect.right - anchorRect.left + 5;
          sidecar.style.right = `${Math.max(rightOffset, 0)}px`;
        } else {
          const leftOffset = anchorRight + 5;
          sidecar.style.left = `${Math.max(leftOffset, 0)}px`;
        }

        const top = anchorTop;
        sidecar.style.top = `${top}px`;
      });
    });
  }, []);

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

  const setControlVisibility = useCallback((controlId: string, visible: boolean) => {
    queryToolbarElements<HTMLElement>(controlId).forEach((element) => {
      element.style.visibility = visible ? 'visible' : 'hidden';
    });
  }, []);

  const setTogglePairVisibility = useCallback(
    (enabledControlId: string, disabledControlId: string, enabled: boolean) => {
      setControlVisibility(enabledControlId, enabled);
      setControlVisibility(disabledControlId, !enabled);
    },
    [setControlVisibility]
  );

  const isControlVisible = useCallback((controlId: string): boolean | null => {
    const element = queryToolbarElements<HTMLElement>(controlId)[0];
    if (!element) {
      return null;
    }
    return getComputedStyle(element).visibility !== 'hidden';
  }, []);

  const syncMeasurementUi = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const shouldEnable =
        typeof override === 'boolean'
          ? override
          : presenter?.isMeasurementToolEnabled?.() ?? activeInteractiveToolRef.current === 'measure';

      const measureElements = queryToolbarElements<HTMLImageElement>('measure');
      const measureOnElements = queryToolbarElements<HTMLImageElement>('measure_on');
      const measureBoxes = queryToolbarSidecars<HTMLDivElement>('measure-box');
      const canvas = document.getElementById('draw-canvas') as HTMLCanvasElement | null;

      if (shouldEnable) {
        measureElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        measureOnElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        measureBoxes.forEach((element) => {
          element.style.display = 'table';
        });
        if (canvas) canvas.style.cursor = 'crosshair';
      } else {
        clearSelectionRange();
        measureOnElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        measureElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        measureBoxes.forEach((element) => {
          element.style.display = 'none';
        });
        const anyMeasurementEnabled = presenter?.isAnyMeasurementEnabled?.() ?? false;
        if (canvas && !anyMeasurementEnabled) {
          canvas.style.cursor = 'default';
        }
        setMeasurementValue(null);
      }
      alignToolbarSidecars();
    },
    [alignToolbarSidecars, clearSelectionRange]
  );

  const syncPickpointUi = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const shouldEnable =
        typeof override === 'boolean'
          ? override
          : presenter?.isPickpointModeEnabled?.() ?? activeInteractiveToolRef.current === 'pick';

      const pickElements = queryToolbarElements<HTMLImageElement>('pick');
      const pickOnElements = queryToolbarElements<HTMLImageElement>('pick_on');
      const pickBoxes = queryToolbarSidecars<HTMLDivElement>('pickpoint-box');
      const canvas = document.getElementById('draw-canvas') as HTMLCanvasElement | null;

      if (shouldEnable) {
        pickElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        pickOnElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        pickBoxes.forEach((element) => {
          element.style.display = 'table';
        });
        if (canvas) canvas.style.cursor = 'crosshair';
      } else {
        clearSelectionRange();
        pickOnElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        pickElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        pickBoxes.forEach((element) => {
          element.style.display = 'none';
        });
        const anyMeasurementEnabled = presenter?.isAnyMeasurementEnabled?.() ?? false;
        if (canvas && !anyMeasurementEnabled) {
          canvas.style.cursor = 'default';
        }
        setPickpointValue(null);
      }
      alignToolbarSidecars();
    },
    [alignToolbarSidecars, clearSelectionRange]
  );

  const syncSectionsUi = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const reference = document.querySelector<HTMLElement>('[data-hop-id="sections_on"]');
    const isActive = reference ? getComputedStyle(reference).visibility !== 'hidden' : false;

    setTogglePairVisibility('sections_on', 'sections', isActive);

    const sectionBoxes = queryToolbarSidecars<HTMLDivElement>('sections-box');
    sectionBoxes.forEach((element) => {
      element.style.display = isActive ? 'table' : 'none';
    });

    alignToolbarSidecars();
  }, [alignToolbarSidecars, setTogglePairVisibility]);

  const syncLightSwitch = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const enabled =
        typeof override === 'boolean'
          ? override
          : presenter?.isLightTrackballEnabled?.() ?? false;

      setTogglePairVisibility('light_on', 'light', enabled);
      if (enabled) {
        setControlVisibility('lighting_off', false);
        setControlVisibility('lighting', true);
      }

      return enabled;
    },
    [setControlVisibility, setTogglePairVisibility]
  );

  const syncInfoUi = useCallback(
    (override?: boolean) => {
      const shouldShow = typeof override === 'boolean' ? override : infoBoxVisibleRef.current;

      const infoElements = queryToolbarElements<HTMLImageElement>('info');
      const infoOnElements = queryToolbarElements<HTMLImageElement>('info_on');
      const infoBoxes = queryToolbarSidecars<HTMLDivElement>('info-box');

      if (shouldShow) {
        infoElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        infoOnElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        infoBoxes.forEach((element) => {
          element.style.display = 'table';
        });
      } else {
        infoOnElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        infoElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        infoBoxes.forEach((element) => {
          element.style.display = 'none';
        });
      }

      alignToolbarSidecars();
      return shouldShow;
    },
    [alignToolbarSidecars]
  );

  const setInfoVisibility = useCallback(
    (visible: boolean) => {
      infoBoxVisibleRef.current = visible;
      syncInfoUi(visible);
    },
    [syncInfoUi]
  );

  const toggleInfoVisibility = useCallback(() => {
    setInfoVisibility(!infoBoxVisibleRef.current);
  }, [setInfoVisibility]);

  const syncLightingSwitch = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const enabled =
        typeof override === 'boolean'
          ? override
          : presenter?.isSceneLightingEnabled?.() ?? (isControlVisible('lighting') ?? false);

      setTogglePairVisibility('lighting', 'lighting_off', enabled);
      if (!enabled) {
        setControlVisibility('light_on', false);
        setControlVisibility('light', true);
      }

      return enabled;
    },
    [isControlVisible, setControlVisibility, setTogglePairVisibility]
  );

  const syncColorSwitch = useCallback(
    (override?: boolean) => {
      const fallback = isControlVisible('color');
      const enabled = typeof override === 'boolean' ? override : fallback ?? true;

      setControlVisibility('color', !enabled);
      setControlVisibility('color_on', enabled);

      return enabled;
    },
    [isControlVisible, setControlVisibility]
  );

  const syncTransparencySwitch = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const presenterState =
        typeof presenter?.isInstanceTransparencyEnabled === 'function'
          ? presenter.isInstanceTransparencyEnabled(getHopAllTag())
          : undefined;

      const enabled =
        typeof override === 'boolean'
          ? override
          : typeof presenterState === 'boolean'
            ? presenterState
            : isControlVisible('transparency_on') ?? false;

      setControlVisibility('transparency_on', enabled);
      setControlVisibility('transparency', !enabled);

      return enabled;
    },
    [isControlVisible, setControlVisibility]
  );

  const syncSpecularUi = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const instances = presenter?._scene?.modelInstances as
        | Record<string, { specularColor?: number[] }>
        | undefined;

      const presenterState = instances
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
        : undefined;

      const enabled =
        typeof override === 'boolean'
          ? override
          : typeof presenterState === 'boolean'
            ? presenterState
            : isControlVisible('specular_on') ?? false;

      setControlVisibility('specular_on', enabled);
      setControlVisibility('specular', !enabled);

      return enabled;
    },
    [isControlVisible, setControlVisibility]
  );

  const syncCameraSwitch = useCallback(
    (override?: boolean) => {
      const fallback = isControlVisible('perspective');
      const enabled = typeof override === 'boolean' ? override : fallback ?? true;

      setControlVisibility('perspective', !enabled);
      setControlVisibility('orthographic', enabled);

      return enabled;
    },
    [isControlVisible, setControlVisibility]
  );

  const syncHotspotSwitch = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const enabled =
        typeof override === 'boolean'
          ? override
          : presenter?.isSpotVisibilityEnabled?.() ?? (isControlVisible('hotspot_on') ?? false);

      setTogglePairVisibility('hotspot_on', 'hotspot', enabled);

      return enabled;
    },
    [isControlVisible, setTogglePairVisibility]
  );

  const syncFullscreenUi = useCallback(
    (isFullscreen: boolean) => {
      setControlVisibility('full', !isFullscreen);
      setControlVisibility('full_on', isFullscreen);
    },
    [setControlVisibility]
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

  const buildSceneOptions = useCallback((): SceneConfiguration => {
    const meshes: SceneMeshes = {};
  const modelInstances: Record<string, ModelInstanceConfiguration> = {};
  const usedMeshNames = new Set<string>();
  const usedInstanceNames = new Set<string>();
  const annotationDefinitions = new Map<string, AnnotationDefinition>();
  let spots: Record<string, unknown> | undefined;

    const meshUrlCounts = new Map<string, number>();

    const assignUniqueMeshUrl = (url: string, meshName: string): string => {
      const [base] = url.split('#');
      const currentCount = meshUrlCounts.get(base) ?? 0;
      meshUrlCounts.set(base, currentCount + 1);
      if (currentCount === 0) {
        return url;
      }

      const fragment = encodeURIComponent(meshName);
      if (url.includes('#')) {
        return `${url}_${fragment}`;
      }
      return `${url}#${fragment}`;
    };

    const createMeshDefinition = (url: string): SceneMeshDefinition => {
      const lower = url.toLowerCase().split(/[?#]/)[0];
      if (lower.endsWith('.ply')) {
        return {
          url,
          renderMode: ['POINT'],
          mType: 'ply'
        };
      }

      // Default to Nexus meshes; 3DHOP updates renderMode asynchronously once loaded.
      return {
        url,
        renderMode: ['FILL', 'POINT'],
        mType: 'nexus'
      };
    };

    const addMesh = (name: string, meshUrl: string) => {
      const uniqueUrl = assignUniqueMeshUrl(meshUrl, name);
      meshes[name] = createMeshDefinition(uniqueUrl);
      usedMeshNames.add(name);
    };

    const modelEntries = models ? Object.entries(models) : [];

    const processModelDefinition = (entryKey: string, definition: ModelDefinition | null | undefined, index: number) => {
      if (!definition) {
        return;
      }

      const safeKey = sanitizeIdentifier(entryKey, `model_${index + 1}`);

      const meshBaseName = definition.meshId ?? `mesh_${safeKey}`;
      const meshName = ensureUniqueName(meshBaseName, usedMeshNames);
      const resolvedUrl = resolveRelativeAssetPath(
        definition.url,
        normalizedBaseUrl,
        resolvedModelUrl
      );
  addMesh(meshName, resolvedUrl);

      const instanceBaseName = definition.instanceId ?? `model_${safeKey}`;
      const instanceName = ensureUniqueName(instanceBaseName, usedInstanceNames);

      const instance: ModelInstanceConfiguration = {
        mesh: meshName,
        ...(definition.instance ? { ...definition.instance } : {})
      };

      if (definition.transform) {
        instance.transform = {
          ...(instance.transform ?? {}),
          ...definition.transform
        };
      }

      const normalizedScale = normalizeScale(definition.scale);
      if (normalizedScale) {
        instance.transform = {
          ...(instance.transform ?? {}),
          scale: normalizedScale
        };
      }

      if (definition.color) {
        instance.color = [...definition.color];
      }
      if (definition.backfaceColor) {
        instance.backfaceColor = [...definition.backfaceColor];
      }
      if (definition.specularColor) {
        instance.specularColor = [...definition.specularColor];
      }
      if (definition.tags) {
        instance.tags = [...definition.tags];
      }
      if (typeof definition.visible === 'boolean') {
        instance.visible = definition.visible;
      }
      if (typeof definition.useSolidColor === 'boolean') {
        instance.useSolidColor = definition.useSolidColor;
      }
      if (typeof definition.alpha === 'number') {
        instance.alpha = definition.alpha;
      }
      if (definition.transparency !== undefined) {
        if (typeof definition.transparency === 'boolean') {
          instance.useTransparency = definition.transparency;
        } else if (definition.transparency) {
          instance.useTransparency = definition.transparency.enabled ?? true;
          if (typeof definition.transparency.alpha === 'number') {
            instance.alpha = definition.transparency.alpha;
          }
        }
      }

      modelInstances[instanceName] = instance;

      if (definition.annotations && definition.annotations.length > 0) {
        const annotationMeshBase = `${instanceName}_spot`;
        const annotationMeshName = ensureUniqueName(annotationMeshBase, usedMeshNames);
        const resolvedAnnotationMeshUrl = resolveRelativeAssetPath(
          definition.annotationMeshUrl,
          normalizedBaseUrl,
          joinAssetPath(normalizedBaseUrl, 'models-system/spot-1.ply')
        );
        addMesh(annotationMeshName, resolvedAnnotationMeshUrl);

        const annotationData = buildAnnotations(definition.annotations, {
          idPrefix: instanceName,
          meshName: annotationMeshName
        });

        if (annotationData.spots) {
          spots = {
            ...(spots ?? {}),
            ...annotationData.spots
          };
        }

        annotationData.map.forEach((value, id) => {
          annotationDefinitions.set(id, value);
        });
      }
    };

    if (modelEntries.length > 0) {
      modelEntries.forEach(([key, definition], index) => {
        processModelDefinition(key, definition, index);
      });
    } else {
      const meshName = ensureUniqueName('mesh_1', usedMeshNames);
      addMesh(meshName, resolvedModelUrl);
      const instanceName = ensureUniqueName('model_1', usedInstanceNames);
      modelInstances[instanceName] = { mesh: meshName };
    }

    sceneContributionsRef.current.forEach((contribution) => {
      if (contribution.meshes) {
        Object.assign(meshes, contribution.meshes);
      }
      if (contribution.modelInstances) {
        Object.assign(modelInstances, contribution.modelInstances);
      }
      if (contribution.spots) {
        spots = {
          ...(spots ?? {}),
          ...contribution.spots
        };
      }
      if (contribution.annotations) {
        Object.entries(contribution.annotations).forEach(([id, definition]) => {
          annotationDefinitions.set(id, definition);
        });
      }
    });

    const scene: SceneConfiguration = {
      meshes,
      modelInstances,
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

    if (spots) {
      scene.spots = spots;
    }

    annotationDefinitionsRef.current = annotationDefinitions;

    return scene;
  }, [models, normalizedBaseUrl, resolvedModelUrl, sceneContributionsVersion]);

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

      const nextTrackball = presenter.getTrackballPosition?.();
      if (Array.isArray(nextTrackball)) {
        notifyTrackballObservers(nextTrackball);
      }

      const hasHotspots = Boolean(sceneOptions.spots && Object.keys(sceneOptions.spots).length > 0);
      setHasHotspotContribution(hasHotspots);

      sceneObserversRef.current.forEach((observer) => observer(presenter));

      if (queryToolbarSidecars('sections-box').length > 0) {
        window.sectiontoolInit?.();
        window.sectiontoolReset?.();
      }

      syncTransparencySwitch();
      syncSpecularUi();
    },
    [buildSceneOptions, notifyTrackballObservers, syncSpecularUi, syncTransparencySwitch]
  );

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

        if (queryToolbarSidecars('sections-box').length > 0) {
          window.sectiontoolInit?.();
          window.sectiontoolReset?.();
          syncSectionsUi();
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
      setActiveInteractiveTool(null);
      activeInteractiveToolRef.current = null;
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

  const contextValue = useMemo<ThreeDHopViewerContextValue>(
    () => ({
      presenter: presenterState,
      assetBaseUrl: normalizedBaseUrl,
      registerSceneContribution,
      registerToolbarAction,
      registerSceneObserver,
    registerTrackballObserver,
    registerAnnotationHandler,
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
    registerTrackballObserver,
    registerAnnotationHandler,
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
  const toolbarCount = toolbarChildren.length;

  useEffect(() => {
    alignToolbarSidecars();
    syncInfoUi(infoBoxVisibleRef.current);
  }, [alignToolbarSidecars, syncInfoUi, toolbarCount, hasHotspotContribution]);

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
    </ThreeDHopViewerContext.Provider>
  );
};
