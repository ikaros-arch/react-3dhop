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
  PresenterInstance,
  SceneContribution,
  SceneObserver,
  ThreeDHopViewerContextValue,
  ToolbarActionHandler,
  TrackballObserver
} from './types.js';

export type ThreeDHopViewerProviderProps = {
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

/**
 * Wraps the viewer subtree with a context that shares presenter references, registration
 * helpers, and derived measurement state with any child component that opts in via the
 * `useThreeDHopViewer` hook.
 */
export const ThreeDHopViewerProvider: React.FC<ThreeDHopViewerProviderProps> = ({
  presenter,
  assetBaseUrl,
  registerSceneContribution,
  registerToolbarAction,
  registerSceneObserver,
  registerTrackballObserver,
  registerAnnotationHandler,
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
      registerToolbarAction,
      registerSceneObserver,
      registerTrackballObserver,
      registerAnnotationHandler,
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
      registerToolbarAction,
      registerSceneObserver,
      registerTrackballObserver,
      registerAnnotationHandler,
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
