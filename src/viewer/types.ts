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
