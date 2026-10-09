import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useThreeDHopViewer } from '@ikaros-arch/react-3dhop';
import { cameraToView, track2view, view2track, viewToCameraAnnotation, type SceneFraming, type TrackballState } from './iiif/camera.js';
import { resolveLanguageMap } from './iiif/language.js';
import type { Diagnostic, LocalizableValue, ParsedCamera, ParsedManifest, ParsedMetadata, ParsedModel } from './iiif/types.js';
import type { SceneFromManifest } from './iiif/toModels.js';

export type IIIFStatus = 'idle' | 'loading' | 'ready' | 'error';

export type IIIFContextValue = {
  status: IIIFStatus;
  error: Error | null;
  /** Non-fatal notes collected while parsing, in the order they were emitted. */
  diagnostics: Diagnostic[];
  parsed: ParsedManifest | null;
  metadata: ParsedMetadata | null;
  models: ParsedModel[];
  cameras: ParsedCamera[];
  languages: string[];
  language: string;
  setLanguage: (language: string) => void;
  /** Resolves any language map from the manifest into the active language. */
  localize: (value: LocalizableValue | undefined) => string;
  measureUnit: string;
  displayUnit: string;
  /**
   * Whether the presenter has established the scene's centre and radius. Camera operations are
   * no-ops until this is true, because there is nothing to convert against yet.
   */
  isSceneReady: boolean;
  /**
   * The scene's characteristic size (reciprocal of the presenter's `sceneRadiusInv`), in the
   * model's own space units. `null` until `isSceneReady`. Useful for anything that needs to scale
   * proportionally to the object itself - e.g. an annotation spot's radius - regardless of
   * whether the model's declared unit is millimetres or metres.
   */
  sceneRadius: number | null;
  /** Animates the camera to the manifest camera at `index`. */
  goToCamera: (index: number, durationSeconds?: number) => void;
  /** Captures the current camera as an IIIF annotation, or `null` if the scene is not ready. */
  saveCurrentView: (label?: string) => Record<string, unknown> | null;
  /** Shows or hides one model. Pass the IIIF annotation id. */
  setModelVisible: (modelId: string, visible: boolean) => void;
  isModelVisible: (modelId: string) => boolean;
  toggleModelTransparency: (modelId: string) => void;
  isModelTransparent: (modelId: string) => boolean;
};

const IIIFContext = createContext<IIIFContextValue | null>(null);

/** Access the IIIF manifest state. Must be called from inside an `<IIIFViewer>`. */
export function useIIIFManifest(): IIIFContextValue {
  const value = useContext(IIIFContext);
  if (!value) {
    throw new Error('useIIIFManifest must be used within an <IIIFViewer>.');
  }
  return value;
}

export type IIIFProviderProps = {
  status: IIIFStatus;
  error: Error | null;
  diagnostics: Diagnostic[];
  parsed: ParsedManifest | null;
  scene: SceneFromManifest | null;
  language: string;
  setLanguage: (language: string) => void;
  children?: React.ReactNode;
};

/**
 * Supplies IIIF state to descendants and bridges it to the live presenter.
 *
 * Rendered inside `<ThreeDHopViewer>` so it can reach the viewer context, which is the only place
 * the presenter — and with it the scene framing that camera conversion needs — is available.
 */
export const IIIFProvider: React.FC<IIIFProviderProps> = ({
  status,
  error,
  diagnostics,
  parsed,
  scene,
  language,
  setLanguage,
  children
}) => {
  const { presenter, registerSceneObserver } = useThreeDHopViewer();
  const [framing, setFraming] = useState<SceneFraming | null>(null);
  // Held as state, not refs: the panels render these as controlled inputs, so a toggle has to
  // produce a new context value or the consumers never re-render and React reverts the checkbox.
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [transparency, setTransparency] = useState<Record<string, boolean>>({});

  // The presenter only derives sceneCenter/sceneRadiusInv once a scene has been set, so read them
  // when the viewer tells us the scene changed rather than on mount.
  useEffect(() => {
    return registerSceneObserver((instance) => {
      const center = instance.sceneCenter;
      const radiusInv = instance.sceneRadiusInv;
      if (Array.isArray(center) && center.length >= 3 && typeof radiusInv === 'number') {
        setFraming({ sceneCenter: [center[0], center[1], center[2]], sceneRadiusInv: radiusInv });
      }
      // A new scene resets every instance to its declared state.
      setVisibility({});
      setTransparency({});
    });
  }, [registerSceneObserver]);

  const localize = useCallback(
    (value: LocalizableValue | undefined) => resolveLanguageMap(value, language),
    [language]
  );

  const goToCamera = useCallback(
    (index: number, durationSeconds = 0.5) => {
      if (!parsed || !framing || !presenter) {
        return;
      }
      const camera = parsed.cameras[index];
      if (!camera) {
        return;
      }

      const view = cameraToView(camera, framing, parsed.models);
      const trackState = view2track(view, framing);

      // The presenter treats a zero duration as "unspecified" and animates over its own default,
      // so jumping straight to the view has to bypass the animation entirely.
      if (durationSeconds > 0 && typeof presenter.animateToTrackballPosition === 'function') {
        presenter.animateToTrackballPosition(trackState, durationSeconds);
      } else {
        presenter.setTrackballPosition?.(trackState);
        presenter.repaint?.();
      }

      if (camera.type === 'OrthographicCamera') {
        presenter.setCameraOrthographic?.();
      } else {
        presenter.setCameraPerspective?.();
      }
    },
    [framing, parsed, presenter]
  );

  const saveCurrentView = useCallback(
    (label?: string) => {
      if (!presenter || !framing) {
        return null;
      }

      const trackState = presenter.getTrackballPosition?.();
      if (!Array.isArray(trackState) || trackState.length < 6) {
        return null;
      }

      const isOrthographic = presenter.getCameraType?.() === 'orthographic';
      const fov = isOrthographic ? 0 : presenter._scene?.space?.cameraFOV ?? 60;

      const view = track2view(trackState as TrackballState, framing, fov);
      return viewToCameraAnnotation(view, { label, sceneId: parsed?.manifest.items?.[0]?.id });
    },
    [framing, parsed, presenter]
  );

  const instanceKeyFor = useCallback(
    (modelId: string) => scene?.instanceIdsByModelId[modelId],
    [scene]
  );

  const isModelVisible = useCallback(
    (modelId: string) => visibility[modelId] ?? true,
    [visibility]
  );

  const setModelVisible = useCallback(
    (modelId: string, visible: boolean) => {
      const key = instanceKeyFor(modelId);
      if (!key || !presenter) {
        return;
      }
      // The presenter only offers a toggle, so state is tracked here to make this idempotent.
      if ((visibility[modelId] ?? true) === visible) {
        return;
      }
      presenter.toggleInstanceVisibilityByName?.(key, true);
      setVisibility((current) => ({ ...current, [modelId]: visible }));
    },
    [instanceKeyFor, presenter, visibility]
  );

  const isModelTransparent = useCallback(
    (modelId: string) => transparency[modelId] ?? false,
    [transparency]
  );

  const toggleModelTransparency = useCallback(
    (modelId: string) => {
      const key = instanceKeyFor(modelId);
      if (!key || !presenter) {
        return;
      }
      presenter.toggleInstanceTransparencyByName?.(key, true);
      setTransparency((current) => ({ ...current, [modelId]: !(current[modelId] ?? false) }));
    },
    [instanceKeyFor, presenter]
  );

  const value = useMemo<IIIFContextValue>(
    () => ({
      status,
      error,
      diagnostics,
      parsed,
      metadata: parsed?.metadata ?? null,
      models: parsed?.models ?? [],
      cameras: parsed?.cameras ?? [],
      languages: parsed?.languages ?? [],
      language,
      setLanguage,
      localize,
      measureUnit: scene?.measureUnit ?? 'mm',
      displayUnit: scene?.displayUnit ?? 'mm',
      isSceneReady: framing !== null,
      sceneRadius: framing && framing.sceneRadiusInv > 0 ? 1 / framing.sceneRadiusInv : null,
      goToCamera,
      saveCurrentView,
      setModelVisible,
      isModelVisible,
      toggleModelTransparency,
      isModelTransparent
    }),
    [
      diagnostics,
      error,
      framing,
      goToCamera,
      isModelTransparent,
      isModelVisible,
      language,
      localize,
      parsed,
      saveCurrentView,
      scene,
      setLanguage,
      setModelVisible,
      status,
      toggleModelTransparency
    ]
  );

  return <IIIFContext.Provider value={value}>{children}</IIIFContext.Provider>;
};
