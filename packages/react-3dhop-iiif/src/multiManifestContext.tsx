import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useThreeDHopViewer } from '@ikaros-arch/react-3dhop';
import type { Diagnostic, ParsedModel } from './iiif/types.js';
import type { SceneFromManifests } from './iiif/toMultiModels.js';

export type IIIFMultiManifestStatus = 'idle' | 'loading' | 'ready' | 'error';

export type ManifestGroup = {
  /** Unique within this scene. Pass to the `manifestKey` argument of the accessors below. */
  key: string;
  sourceId: string;
  label: string;
  models: ParsedModel[];
};

export type IIIFMultiManifestContextValue = {
  status: IIIFMultiManifestStatus;
  error: Error | null;
  diagnostics: Diagnostic[];
  manifests: ManifestGroup[];
  measureUnit: string;
  displayUnit: string;
  /** Whether the presenter has established the scene, so instance toggles have something to act on. */
  isSceneReady: boolean;
  /** Shows or hides one model. `modelId` is the IIIF annotation id, scoped to `manifestKey`. */
  setModelVisible: (manifestKey: string, modelId: string, visible: boolean) => void;
  isModelVisible: (manifestKey: string, modelId: string) => boolean;
  toggleModelTransparency: (manifestKey: string, modelId: string) => void;
  isModelTransparent: (manifestKey: string, modelId: string) => boolean;
};

const IIIFMultiManifestContext = createContext<IIIFMultiManifestContextValue | null>(null);

/** Access the multi-manifest scene state. Must be called from inside an `<IIIFMultiManifestViewer>`. */
export function useIIIFMultiManifest(): IIIFMultiManifestContextValue {
  const value = useContext(IIIFMultiManifestContext);
  if (!value) {
    throw new Error('useIIIFMultiManifest must be used within an <IIIFMultiManifestViewer>.');
  }
  return value;
}

export type IIIFMultiManifestProviderProps = {
  status: IIIFMultiManifestStatus;
  error: Error | null;
  diagnostics: Diagnostic[];
  scene: SceneFromManifests | null;
  children?: React.ReactNode;
};

function compositeKey(manifestKey: string, modelId: string): string {
  return `${manifestKey}::${modelId}`;
}

/**
 * Supplies multi-manifest scene state to descendants and bridges it to the live presenter.
 *
 * A deliberately smaller sibling of `<IIIFProvider>`: cameras, saved views, metadata and language
 * are per-manifest concepts that don't yet have a defined multi-manifest behaviour, so this only
 * covers per-model visibility/transparency, each scoped by the manifest it came from.
 */
export const IIIFMultiManifestProvider: React.FC<IIIFMultiManifestProviderProps> = ({
  status,
  error,
  diagnostics,
  scene,
  children
}) => {
  const { presenter, registerSceneObserver } = useThreeDHopViewer();
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [transparency, setTransparency] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return registerSceneObserver(() => {
      setIsSceneReady(true);
      // A new scene resets every instance to its declared state.
      setVisibility({});
      setTransparency({});
    });
  }, [registerSceneObserver]);

  const instanceKeyFor = useCallback(
    (manifestKey: string, modelId: string) =>
      scene?.manifests.find((manifest) => manifest.key === manifestKey)?.instanceIdsByModelId[modelId],
    [scene]
  );

  const isModelVisible = useCallback(
    (manifestKey: string, modelId: string) => visibility[compositeKey(manifestKey, modelId)] ?? true,
    [visibility]
  );

  const setModelVisible = useCallback(
    (manifestKey: string, modelId: string, visible: boolean) => {
      const key = instanceKeyFor(manifestKey, modelId);
      const stateKey = compositeKey(manifestKey, modelId);
      if (!key || !presenter) {
        return;
      }
      if ((visibility[stateKey] ?? true) === visible) {
        return;
      }
      presenter.toggleInstanceVisibilityByName?.(key, true);
      setVisibility((current) => ({ ...current, [stateKey]: visible }));
    },
    [instanceKeyFor, presenter, visibility]
  );

  const isModelTransparent = useCallback(
    (manifestKey: string, modelId: string) => transparency[compositeKey(manifestKey, modelId)] ?? false,
    [transparency]
  );

  const toggleModelTransparency = useCallback(
    (manifestKey: string, modelId: string) => {
      const key = instanceKeyFor(manifestKey, modelId);
      const stateKey = compositeKey(manifestKey, modelId);
      if (!key || !presenter) {
        return;
      }
      presenter.toggleInstanceTransparencyByName?.(key, true);
      setTransparency((current) => ({ ...current, [stateKey]: !(current[stateKey] ?? false) }));
    },
    [instanceKeyFor, presenter]
  );

  const manifests = useMemo<ManifestGroup[]>(
    () =>
      scene?.manifests.map((manifest) => ({
        key: manifest.key,
        sourceId: manifest.sourceId,
        label: manifest.parsed.metadata.label,
        models: manifest.models
      })) ?? [],
    [scene]
  );

  const value = useMemo<IIIFMultiManifestContextValue>(
    () => ({
      status,
      error,
      diagnostics,
      manifests,
      measureUnit: scene?.measureUnit ?? 'mm',
      displayUnit: scene?.displayUnit ?? 'mm',
      isSceneReady,
      setModelVisible,
      isModelVisible,
      toggleModelTransparency,
      isModelTransparent
    }),
    [
      diagnostics,
      error,
      isModelTransparent,
      isModelVisible,
      isSceneReady,
      manifests,
      scene,
      setModelVisible,
      status,
      toggleModelTransparency
    ]
  );

  return <IIIFMultiManifestContext.Provider value={value}>{children}</IIIFMultiManifestContext.Provider>;
};
