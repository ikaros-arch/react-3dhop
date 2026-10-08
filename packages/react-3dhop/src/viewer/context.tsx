/**
 * Exposes the shared 3DHOP viewer context so React children can subscribe to presenter
 * state, toolbar hooks, and measurement updates without directly touching the viewer API.
 * The provider composes the full context value while the public hook enforces usage
 * within the configured subtree.
 */

import React, { createContext, useContext, useMemo } from 'react';
import type {
  AnnotationPickHandler,
  CoordinateCorrections,
  InteractiveTool,
  InteractiveToolConfig,
  LightObserver,
  PresenterInstance,
  SceneContribution,
  SceneObserver,
  SceneReadyObserver,
  ThemeName,
  ThreeDHopViewerContextValue,
  ToolbarActionHandler,
  TrackballObserver
} from './types.js';

export type ThreeDHopViewerProviderProps = {
  presenter: PresenterInstance | null;
  assetBaseUrl: string;
  registerSceneContribution: (key: string, contribution: SceneContribution | null) => () => void;
  updateSceneContribution: (key: string, contribution: SceneContribution) => void;
  registerToolbarAction: (actions: string | string[], handler: ToolbarActionHandler) => () => void;
  triggerToolbarAction: (action: string) => void;
  registerSceneObserver: (observer: SceneObserver) => () => void;
  registerSceneReadyObserver: (observer: SceneReadyObserver) => () => void;
  registerTrackballObserver: (observer: TrackballObserver) => () => void;
  registerLightObserver: (observer: LightObserver) => () => void;
  registerAnnotationHandler: (handler: AnnotationPickHandler) => () => void;
  registerInteractiveTool: (config: InteractiveToolConfig) => () => void;
  toggleInteractiveTool: (toolId: InteractiveTool) => void;
  activeInteractiveTool: InteractiveTool | null;
  captureToolState: (toolId?: InteractiveTool) => { toolId: InteractiveTool; state: unknown } | null;
  restoreToolState: (toolId: InteractiveTool, state: unknown) => void;
  realignToolbar: () => void;
  theme: ThemeName;
  hasHotspotContribution: boolean;
  measurementUnits: string;
  measurementValue: number | null;
  pickpointValue: [number, number, number] | null;
  setMeasurementValue: React.Dispatch<React.SetStateAction<number | null>>;
  setPickpointValue: React.Dispatch<React.SetStateAction<[number, number, number] | null>>;
  coordinateCorrections: Required<CoordinateCorrections>;
  children: React.ReactNode;
};

const ThreeDHopViewerContext = createContext<ThreeDHopViewerContextValue | null>(null);

/**
 * Returns the nearest `ThreeDHopViewerContextValue`, throwing when it is accessed outside
 * the `ThreeDHopViewerProvider` so consumers catch misconfiguration early.
 */
export const useThreeDHopViewer = (): ThreeDHopViewerContextValue => {
  const context = useContext(ThreeDHopViewerContext);
  if (!context) {
    throw new Error('useThreeDHopViewer must be used within a ThreeDHopViewerProvider');
  }
  return context;
};

/** Like `useThreeDHopViewer`, but returns `null` outside a provider instead of throwing. */
export const useOptionalThreeDHopViewer = (): ThreeDHopViewerContextValue | null => useContext(ThreeDHopViewerContext);

/**
 * Wraps the viewer subtree with a context that shares presenter references, registration
 * helpers, and derived measurement state with any child component that opts in via the
 * `useThreeDHopViewer` hook.
 */
export const ThreeDHopViewerProvider: React.FC<ThreeDHopViewerProviderProps> = ({
  presenter,
  assetBaseUrl,
  registerSceneContribution,
  updateSceneContribution,
  registerToolbarAction,
  triggerToolbarAction,
  registerSceneObserver,
  registerSceneReadyObserver,
  registerTrackballObserver,
  registerLightObserver,
  registerAnnotationHandler,
  registerInteractiveTool,
  toggleInteractiveTool,
  activeInteractiveTool,
  captureToolState,
  restoreToolState,
  realignToolbar,
  theme,
  hasHotspotContribution,
  measurementUnits,
  measurementValue,
  pickpointValue,
  setMeasurementValue,
  setPickpointValue,
  coordinateCorrections,
  children
}) => {
  const value = useMemo<ThreeDHopViewerContextValue>(
    () => ({
      presenter,
      assetBaseUrl,
      registerSceneContribution,
      updateSceneContribution,
      registerToolbarAction,
      triggerToolbarAction,
      registerSceneObserver,
      registerSceneReadyObserver,
      registerTrackballObserver,
      registerLightObserver,
      registerAnnotationHandler,
      registerInteractiveTool,
      toggleInteractiveTool,
      activeInteractiveTool,
      captureToolState,
      restoreToolState,
      realignToolbar,
      theme,
      hasHotspotContribution,
      measurementUnits,
      measurementValue,
      pickpointValue,
      setMeasurementValue,
      setPickpointValue,
      coordinateCorrections
    }),
    [
      presenter,
      assetBaseUrl,
      registerSceneContribution,
      updateSceneContribution,
      registerToolbarAction,
      triggerToolbarAction,
      registerSceneObserver,
      registerSceneReadyObserver,
      registerTrackballObserver,
      registerLightObserver,
      registerAnnotationHandler,
      registerInteractiveTool,
      toggleInteractiveTool,
      activeInteractiveTool,
      captureToolState,
      restoreToolState,
      realignToolbar,
      theme,
      hasHotspotContribution,
      measurementUnits,
      measurementValue,
      pickpointValue,
      setMeasurementValue,
      setPickpointValue,
      coordinateCorrections
    ]
  );

  return <ThreeDHopViewerContext.Provider value={value}>{children}</ThreeDHopViewerContext.Provider>;
};
