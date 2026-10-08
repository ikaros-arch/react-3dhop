import React from 'react';
import type { AnnotationDefinition } from '../utils/annotations.js';

export type Vector3 = [number, number, number];

/** Primitive kinds accepted by 3DHOP's `createEntity`. */
export type SceneEntityType = 'points' | 'lines' | 'triangles';

/**
 * A helper-geometry entity as 3DHOP stores it in `_scene.entities`. Entities are drawn on top
 * of the models (grids, axes, measurement guides); they are wiped by every `setScene`.
 */
export type SceneEntity = {
  visible: boolean;
  type: SceneEntityType;
  color: [number, number, number, number];
  useTransparency: boolean;
  pointSize: number;
  zOff: number;
  transform: { matrix: number[] };
  renderable: unknown;
};

/** Declarative description of an entity; see `useSceneEntity`. */
export type SceneEntitySpec = {
  type: SceneEntityType;
  vertices: Vector3[];
  color?: [number, number, number, number];
  useTransparency?: boolean;
  pointSize?: number;
  zOff?: number;
  visible?: boolean;
};

/** Axis-aligned bounds of the loaded scene in model space; see `useSceneBounds`. */
export type SceneBounds = {
  min: Vector3;
  max: Vector3;
  center: Vector3;
  size: Vector3;
  /** Half the diagonal. */
  radius: number;
  /**
   * `vertices` when every visible mesh contributed real geometry (Nexus base level or PLY
   * bounding box); `spheres` when at least one fell back to 3DHOP's bounding-sphere estimate.
   */
  source: 'vertices' | 'spheres';
};

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
  /** Re-displays a previously completed measurement without requiring the two points be re-picked. */
  restoreMeasurement?: (pointA: Vector3, pointB: Vector3) => void;
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
  /** Helper geometry drawn over the models. Wiped by `setScene`; see `useSceneEntity`. */
  createEntity?: (name: string, type: SceneEntityType, vertices: Vector3[] | number[][]) => SceneEntity;
  deleteEntity?: (name: string) => void;
  clearEntities?: () => void;
  /**
   * Sets the light direction from a point in the unit disc: `x`, `y` in [-0.5, 0.5], `y` up.
   * Stores the result in `_lightDirection` as a unit vector pointing *towards* the light.
   */
  rotateLight?: (x: number, y: number) => void;
  _lightDirection?: number[];
  /** Set by `saveScreenshot()`; the PNG data URL is written to `screenshotData` on the next draw. */
  screenshotData?: string | null;
  isCapturingScreenshot?: boolean;
  /** Recomputes `_sceneBbox*` from every clippable instance's bounding sphere. */
  _calculateBounding?: () => void;
  _sceneBboxMin?: number[];
  _sceneBboxMax?: number[];
  _sceneBboxCenter?: number[];
  _sceneBboxDiag?: number;
  /** True once every mesh/texture/background of the current scene has loaded. */
  _isSceneReady?: () => boolean;
  _testReady?: () => void;
  /**
   * Centre of the scene in model space, and the reciprocal of its radius. The presenter derives
   * both from `space.centerMode`/`space.radiusMode` once the scene is set, and uses them to map
   * model space onto the unit-sphere space the trackball works in. Converting between a
   * world-space camera and a trackball state needs both.
   */
  sceneCenter?: number[];
  sceneRadiusInv?: number;
  /** `pointA`/`pointB` are only passed once a measurement completes (the second pick). */
  _onEndMeasurement?: (measure: number, pointA?: Vector3, pointB?: Vector3) => void;
  _onEndPickingPoint?: (point: number[]) => void;
  _onPickedSpot?: (id: string) => void;
  destroy?: () => void;
  repaint?: () => void;
  ui?: {
    postDrawEvent?: () => void;
    gl?: unknown;
    /** Canvas size in CSS pixels, as of the last rendered frame. */
    width?: number;
    height?: number;
  };
  /**
   * SpiderGL's transformation stack. `modelViewProjectionMatrix` reflects the camera as of the
   * last rendered frame with the model stack back at its base (identity) - i.e. it maps scene-
   * space points (already through `_scene.space`'s transform, but not a spot's or instance's own)
   * straight to clip space. See `getAnnotationScreenPosition` for projecting a spot onto the
   * canvas with it.
   */
  xform?: {
    modelViewProjectionMatrix?: number[];
  };
  _scene?: {
    meshes?: Record<string, SceneMeshRuntime>;
    modelInstances?: Record<string, SceneInstanceRuntime>;
    spots?: Record<string, SceneSpotRuntime>;
    entities?: Record<string, SceneEntity>;
    space?: SceneSpaceConfig & { transform?: { matrix?: number[] } };
    config?: SceneRenderConfig;
  };
} & Record<string, unknown>;

/** A mesh as 3DHOP holds it at runtime, after `setScene` has created the renderable. */
export type SceneMeshRuntime = {
  url?: string;
  mType?: 'nexus' | 'ply';
  transform?: { matrix?: number[] };
  renderable?: {
    isReady?: boolean;
    datasetCenter?: number[];
    datasetRadius?: number;
    /** PLY only. */
    boundingBox?: { min: number[]; max: number[] };
    /** Nexus only; `basev` is the base-level vertex buffer once node 0 has loaded. */
    mesh?: { basev?: Float32Array; sphere?: { center: number[]; radius: number } };
  } | null;
};

/** A model instance as 3DHOP holds it at runtime. */
export type SceneInstanceRuntime = {
  mesh?: string;
  visible?: boolean;
  clippable?: boolean;
  useTransparency?: boolean;
  specularColor?: number[];
  transform?: { matrix?: number[] };
  [key: string]: unknown;
};

/**
 * A spot as 3DHOP holds it at runtime, after `setScene` has parsed it. Unlike meshes/instances,
 * every one of these fields is read straight off this object on *every draw call* (see
 * `_drawSceneSpots`/`_drawScenePickingSpots` in presenter.js) rather than baked in once - so
 * mutating `color`/`alpha`/`transform.matrix` in place and requesting a repaint is enough to
 * change how a spot looks, with no `setScene` (and the full mesh reload that implies) required.
 */
export type SceneSpotRuntime = {
  mesh?: string;
  color?: number[];
  alpha?: number;
  alphaHigh?: number;
  visible?: boolean;
  transform?: { matrix?: number[] };
  [key: string]: unknown;
};

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
/** Fires once per scene apply, when every mesh of that scene has finished loading. */
export type SceneReadyObserver = (presenter: PresenterInstance) => void;
export type TrackballObserver = (trackState: number[]) => void;
/** Receives 3DHOP's `_lightDirection` (unit vector towards the light) whenever it changes. */
export type LightObserver = (direction: Vector3) => void;

/** Identifier of a mutually exclusive canvas tool. Built-ins are `'measure'` and `'pick'`. */
export type InteractiveTool = string;

export type InteractiveToolPickContext = {
  /** The picked point as 3DHOP reports it, in scene space — use this for entities. */
  raw: Vector3;
  /** `raw` with `coordinateCorrections` applied — use this for display. */
  corrected: Vector3;
  presenter: PresenterInstance;
};

/**
 * Describes a canvas tool to the viewer's exclusivity manager. `enable` switches the underlying
 * presenter mode; `isEnabled` reads it back (falls back to the manager's own record); `syncUi`
 * mirrors state into non-React DOM (used by the legacy toolbar); `onPick` receives pick-point
 * results while this tool is active.
 */
export type InteractiveToolConfig = {
  id: InteractiveTool;
  enable?: (presenter: PresenterInstance, enabled: boolean) => void;
  isEnabled?: (presenter: PresenterInstance) => boolean | undefined;
  syncUi?: (enabled?: boolean) => void;
  onPick?: (context: InteractiveToolPickContext) => void;
  /**
   * Snapshots this tool's in-progress state (e.g. picked points), for a caller to persist
   * alongside a saved camera view. Omit when the tool has nothing capturable, or when its state
   * lives somewhere this wrapper can't read (3DHOP's `measure` tool only ever reports a final
   * distance, never the points behind it, so it has no `captureState`).
   */
  captureState?: () => unknown;
  /** Restores state previously returned by `captureState`. Only called while this tool is active. */
  restoreState?: (state: unknown) => void;
};

export type ThemeName = 'light' | 'dark';
export type ThemeMode = ThemeName | 'system';

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
  /**
   * Updates an already-registered contribution's record for whenever the *next* full rebuild
   * happens, without forcing one now and without the disposer `registerSceneContribution`
   * returns - for callers that already pushed an equivalent change straight onto the live
   * presenter (see `Annotations`' in-place spot patching).
   */
  updateSceneContribution: (key: string, contribution: SceneContribution) => void;
  registerToolbarAction: (actions: string | string[], handler: ToolbarActionHandler) => () => void;
  /**
   * Runs a toolbar action by id, exactly as if its icon had been clicked inside `#toolbar` -
   * first any handler registered via `registerToolbarAction`/`registerInteractiveTool`, then
   * the built-in actions (`home`, `zoomin`, `zoomout`, `lighting`, `color`, `specular`,
   * `transparency`, `perspective`/`orthographic`, `hotspot`, `full`, `info`, `screenshot`).
   * `LightingControl`, `ColorControl`, `SpecularControl`, `TransparencyControl`, `CameraControl`
   * and `HomeControl` have no toggle state of their own - normally they only work because the
   * vendored 3DHOP `init.js` wires a native click listener to toolbar icons inside `#toolbar`.
   * If you render one of those controls' icons somewhere else (e.g. a custom sidebar instead of
   * the toolbar), nothing will call that listener, so wire the icon's own click handler to
   * `triggerToolbarAction('<id>')` yourself, using the id the control renders (e.g. `'lighting'`,
   * `'color'`). See "Driving toolbar actions from outside `#toolbar`" in docs/extending.md.
   */
  triggerToolbarAction: (action: string) => void;
  registerSceneObserver: (observer: SceneObserver) => () => void;
  registerSceneReadyObserver: (observer: SceneReadyObserver) => () => void;
  registerTrackballObserver: (observer: TrackballObserver) => () => void;
  registerLightObserver: (observer: LightObserver) => () => void;
  registerAnnotationHandler: (handler: AnnotationPickHandler) => () => void;
  registerInteractiveTool: (config: InteractiveToolConfig) => () => void;
  toggleInteractiveTool: (toolId: InteractiveTool) => void;
  activeInteractiveTool: InteractiveTool | null;
  /**
   * Snapshots a tool's in-progress state via its `captureState` (defaults to whichever tool is
   * active); `null` when there's no active tool, or that tool declared no `captureState`.
   */
  captureToolState: (toolId?: InteractiveTool) => { toolId: InteractiveTool; state: unknown } | null;
  /** Activates `toolId` (if it isn't already) and passes `state` to its `restoreState`. */
  restoreToolState: (toolId: InteractiveTool, state: unknown) => void;
  /** Re-positions toolbar sidecars next to their anchor icons; call after showing/hiding one. */
  realignToolbar: () => void;
  /** The theme in effect after resolving `'system'`. */
  theme: ThemeName;
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
  /**
   * Colour scheme for the viewer's own UI (toolbar sidecars, overlays). `'system'` follows
   * `prefers-color-scheme`. Applied as `data-r3dhop-theme` on the root and, for `dark`, as inline
   * CSS custom properties; `light` sets none so stylesheet overrides of `--r3dhop-*` win.
   */
  theme?: ThemeMode;
  /**
   * Supplies the toolbar explicitly instead of inferring it from `children` by element type.
   * Without this, a `<Toolbar>` is only recognised when it is a *direct* child — anything that
   * wraps it (a context provider, a layout component) defeats the `child.type === Toolbar` check,
   * silently falling back to the built-in default toolbar instead. Packages that interpose their
   * own wrapper between this component and the caller's children (as `@ikaros-arch/react-3dhop-iiif`
   * does) should extract the toolbar from their own `children` and pass it here.
   */
  toolbar?: React.ReactNode;
  children?: React.ReactNode;
};
