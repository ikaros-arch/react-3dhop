// Split viewer context logic into context.tsx:
// new provider now builds the context value and
// exports the useThreeDHopViewer hook while keeping
// all public types available for re-export.


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

export const useThreeDHopViewer = (): ThreeDHopViewerContextValue => {
  const context = useContext(ThreeDHopViewerContext);
  if (!context) {
    throw new Error('useThreeDHopViewer must be used within a ThreeDHopViewerProvider');
  }
  return context;
};

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
