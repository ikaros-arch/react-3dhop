import React from 'react';
import type { AnnotationDefinition } from '../utils/annotations.js';

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
  getCameraType?: () => CameraType;
  setCameraPerspective?: () => void;
  setCameraOrthographic?: () => void;
  setNexusTargetError?: (error: number) => void;
  getNexusTargetError?: () => number;
  toggleInstanceVisibilityByName?: (name: string, redraw?: boolean) => void;
  toggleInstanceTransparencyByName?: (name: string, redraw?: boolean) => void;
  /**
   * Centre of the scene in model space, and the reciprocal of its radius. The presenter derives
   * both from `space.centerMode`/`space.radiusMode` once the scene is set, and uses them to map
   * model space onto the unit-sphere space the trackball works in. Converting between a
   * world-space camera and a trackball state needs both.
   */
  sceneCenter?: number[];
  sceneRadiusInv?: number;
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
    space?: SceneSpaceConfig;
    config?: SceneRenderConfig;
  };
} & Record<string, unknown>;

export type CameraType = 'perspective' | 'orthographic';

/**
 * How the presenter positions and frames the scene: where the origin of the trackball sits, how
 * big the scene is considered to be, and the camera's projection. Mirrors `_parseSpace` in
 * `presenter.js`; every field is optional and falls back to the presenter's own default.
 */
export type SceneSpaceConfig = {
  centerMode?: 'first' | 'scene' | 'specific' | 'explicit';
  radiusMode?: 'first' | 'scene' | 'specific' | 'explicit';
  whichInstanceCenter?: string;
  whichInstanceRadius?: string;
  explicitCenter?: [number, number, number];
  explicitRadius?: number;
  transform?: ModelTransformConfig;
  cameraFOV?: number;
  cameraNearFar?: [number, number];
  cameraType?: CameraType;
  sceneLighting?: boolean;
};

/**
 * Presentation-level rendering settings. Mirrors `_parseConfig` in `presenter.js`; every field is
 * optional and falls back to the presenter's own default.
 */
export type SceneRenderConfig = {
  pickedpointColor?: [number, number, number];
  measurementColor?: [number, number, number];
  showClippingPlanes?: boolean;
  showClippingBorder?: boolean;
  clippingBorderSize?: number;
  clippingBorderColor?: [number, number, number];
  pointSize?: number;
  pointSizeMinMax?: [number, number];
  autoSaveScreenshot?: boolean;
  screenshotBaseName?: string;
  screenshotTime?: boolean;
};

export type TrackballName =
  | 'TurnTableTrackball'
  | 'TurntablePanTrackball'
  | 'PanTiltTrackball'
  | 'SphereTrackball'
  | 'RailTrackball';

export type TrackOptions = {
  startPhi: number;
  startTheta: number;
  startDistance: number;
  minMaxPhi: [number, number];
  minMaxTheta: [number, number];
  minMaxDist: [number, number];
  [key: string]: unknown;
};

/**
 * Trackball selection. `type` accepts the *name* of one of 3DHOP's trackball globals so callers
 * never have to reach into `window` themselves; the constructor itself is still accepted for
 * anyone supplying a custom trackball.
 */
export type TrackballConfig = {
  type?: TrackballName | unknown;
  trackOptions?: Partial<TrackOptions>;
  locked?: boolean;
};

export type SceneMeshDefinition = {
  url: string;
  renderMode?: string[];
  mType?: 'nexus' | 'ply';
};

export type SceneMeshes = Record<string, SceneMeshDefinition>;

export type ModelTransformConfig = {
  translation?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  matrix?: number[];
};

export type ModelInstanceConfiguration = {
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

export type SceneConfiguration = {
  meshes: SceneMeshes;
  modelInstances: Record<string, ModelInstanceConfiguration>;
  trackball: {
    type: unknown;
    trackOptions: TrackOptions;
    locked?: boolean;
  };
  spots?: Record<string, unknown>;
  space?: SceneSpaceConfig;
  config?: SceneRenderConfig;
};

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
  /** Scene framing and camera settings, merged over the presenter's defaults. */
  space?: SceneSpaceConfig;
  /** Rendering settings, merged over the presenter's defaults. */
  config?: SceneRenderConfig;
  /** Trackball type and start position, merged over the viewer's defaults. */
  trackball?: TrackballConfig;
  /**
   * Nexus screen-space error target. Lower values stream more detail at the cost of bandwidth;
   * the presenter defaults to `1.0`.
   */
  nexusTargetError?: number;
  children?: React.ReactNode;
};
