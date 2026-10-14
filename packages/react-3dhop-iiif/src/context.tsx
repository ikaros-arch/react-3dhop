import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  discToRotateLightArgs,
  getHopAllTag,
  lightDirectionToDisc,
  useThreeDHopViewer,
  type SectionsState
} from '@ikaros-arch/react-3dhop';
import { cameraToView, track2view, view2track, viewToCameraAnnotation, type SceneFraming, type TrackballState } from './iiif/camera.js';
import { createCommentId, type NewComment } from './iiif/comments.js';
import { resolveLanguageMap } from './iiif/language.js';
import type {
  Diagnostic,
  LocalizableValue,
  ParsedCamera,
  ParsedComment,
  ParsedManifest,
  ParsedMetadata,
  ParsedModel,
  Vector3,
  ViewerState
} from './iiif/types.js';
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
  /**
   * The manifest's comment annotations, plus any added in this session. Edits are local to the
   * viewer instance — persisting them (to a file export or a backend) is a consumer concern; see
   * `commentsToAnnotationPage`/`annotationPageToComments` for round-tripping them as IIIF JSON.
   */
  comments: ParsedComment[];
  /** Adds a comment to the live list and returns its id. */
  addComment: (comment: NewComment) => string;
  /** Patches an existing comment by id. Unset fields are left unchanged. */
  updateComment: (id: string, patch: Partial<Omit<NewComment, 'id'>>) => void;
  removeComment: (id: string) => void;
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
  /**
   * Animates the camera to the manifest camera at `index`. Also applies that camera's
   * `viewerState.modelVisibility`/`modelTransparency`/`solidColor`/`lighting`, if it carries any —
   * `sections` is left for the caller to apply (see `ParsedCamera.viewerState`), since clipping
   * planes are owned by whichever component renders `<SectionsControl>`, not this context.
   */
  goToCamera: (index: number, durationSeconds?: number) => void;
  /**
   * Captures the current camera as an IIIF annotation, or `null` if the scene is not ready. Also
   * captures this session's model visibility/transparency/solid-colour overrides and the current
   * lighting state automatically, plus `sections` when passed in — the caller supplies that one
   * because this context doesn't own `<SectionsControl>`'s state. See
   * `ParsedCamera.viewerState`/`ViewerState`.
   */
  saveCurrentView: (label?: string, options?: { sections?: SectionsState }) => Record<string, unknown> | null;
  /** Shows or hides one model. Pass the IIIF annotation id. */
  setModelVisible: (modelId: string, visible: boolean) => void;
  isModelVisible: (modelId: string) => boolean;
  toggleModelTransparency: (modelId: string) => void;
  /** Sets a model's transparency to a specific state, unlike `toggleModelTransparency`. */
  setModelTransparent: (modelId: string, transparent: boolean) => void;
  isModelTransparent: (modelId: string) => boolean;
  /**
   * Scene-wide texture/solid-colour toggle — 3DHOP has no per-model equivalent, unlike visibility
   * and transparency.
   */
  isSolidColorEnabled: () => boolean;
  setSolidColor: (enabled: boolean) => void;
  /**
   * Captures model visibility/transparency/solid-colour/lighting as a `ViewerState`, or `undefined`
   * when there's nothing to capture (nothing overridden this session, and no lighting API on the
   * presenter). Doesn't include `sections` — merge that in yourself, same as `saveCurrentView`,
   * since this context doesn't own `<SectionsControl>`'s state. For consumers with their own saved
   * view/camera concept that isn't `saveCurrentView`'s IIIF annotation shape.
   */
  captureViewerState: () => ViewerState | undefined;
  /**
   * Applies `modelVisibility`/`modelTransparency`/`solidColor`/`lighting` from a `ViewerState`.
   * `sections` is ignored — apply it to your own `<SectionsControl>` state instead. The inverse of
   * `captureViewerState`.
   */
  applyViewerState: (viewerState: ViewerState | undefined) => void;
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
  // Scene-wide, unlike visibility/transparency: 3DHOP's solid-colour toggle has no per-model
  // variant, only `toggleInstanceSolidColor(getHopAllTag())`. `undefined` means "not touched this
  // session" - there's no getter to read the real initial state from.
  const [solidColor, setSolidColorState] = useState<boolean | undefined>(undefined);
  const [comments, setComments] = useState<ParsedComment[]>(() => parsed?.comments ?? []);

  // Keyed on the raw manifest, not `parsed`: switching language re-parses into a new `parsed`
  // object on every call (see IIIFViewer's `localized`), which would otherwise wipe out
  // session-added comments on every language switch even though their content hasn't changed.
  const manifestIdentity = parsed?.manifest ?? null;
  useEffect(() => {
    setComments(parsed?.comments ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestIdentity]);

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
      setSolidColorState(undefined);
    });
  }, [registerSceneObserver]);

  const localize = useCallback(
    (value: LocalizableValue | undefined) => resolveLanguageMap(value, language),
    [language]
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

  const setModelTransparent = useCallback(
    (modelId: string, transparent: boolean) => {
      const key = instanceKeyFor(modelId);
      if (!key || !presenter) {
        return;
      }
      // Mirrors setModelVisible's idempotency guard: the presenter only offers a toggle.
      if ((transparency[modelId] ?? false) === transparent) {
        return;
      }
      presenter.toggleInstanceTransparencyByName?.(key, true);
      setTransparency((current) => ({ ...current, [modelId]: transparent }));
    },
    [instanceKeyFor, presenter, transparency]
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

  const isSolidColorEnabled = useCallback(() => solidColor ?? false, [solidColor]);

  const setSolidColor = useCallback(
    (enabled: boolean) => {
      if (!presenter) {
        return;
      }
      // Mirrors setModelVisible/setModelTransparent's idempotency guard: the presenter only offers
      // a toggle, scoped to every instance via getHopAllTag() rather than one model's name.
      if ((solidColor ?? false) === enabled) {
        return;
      }
      presenter.toggleInstanceSolidColor?.(getHopAllTag(), true);
      setSolidColorState(enabled);
    },
    [presenter, solidColor]
  );

  const captureViewerState = useCallback((): ViewerState | undefined => {
    if (!presenter) {
      return undefined;
    }
    const viewerState: ViewerState = {};
    if (Object.keys(visibility).length > 0) {
      viewerState.modelVisibility = { ...visibility };
    }
    if (Object.keys(transparency).length > 0) {
      viewerState.modelTransparency = { ...transparency };
    }
    if (solidColor !== undefined) {
      viewerState.solidColor = solidColor;
    }
    // Unlike solid colour, lighting has a real getter - no need to track it ourselves, so this
    // reflects whatever is actually on screen rather than only what was touched this session.
    if (typeof presenter.isSceneLightingEnabled === 'function') {
      const direction = presenter._lightDirection;
      viewerState.lighting = {
        enabled: presenter.isSceneLightingEnabled(),
        ...(Array.isArray(direction) && direction.length >= 3
          ? { direction: [direction[0], direction[1], direction[2]] as Vector3 }
          : {})
      };
    }
    return Object.keys(viewerState).length > 0 ? viewerState : undefined;
  }, [presenter, visibility, transparency, solidColor]);

  const applyViewerState = useCallback(
    (viewerState: ViewerState | undefined) => {
      if (!viewerState || !presenter) {
        return;
      }
      // `sections` is deliberately not applied here - see this function's doc comment.
      Object.entries(viewerState.modelVisibility ?? {}).forEach(([modelId, visible]) => setModelVisible(modelId, visible));
      Object.entries(viewerState.modelTransparency ?? {}).forEach(([modelId, transparent]) =>
        setModelTransparent(modelId, transparent)
      );
      if (viewerState.solidColor !== undefined) {
        setSolidColor(viewerState.solidColor);
      }
      if (viewerState.lighting) {
        presenter.enableSceneLighting?.(viewerState.lighting.enabled);
        if (viewerState.lighting.direction) {
          const disc = lightDirectionToDisc(viewerState.lighting.direction);
          presenter.rotateLight?.(...discToRotateLightArgs(disc));
        }
      }
    },
    [presenter, setModelVisible, setModelTransparent, setSolidColor]
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

      // `sections` is deliberately not applied here - see this function's doc comment.
      applyViewerState(camera.viewerState);
    },
    [framing, parsed, presenter, applyViewerState]
  );

  const saveCurrentView = useCallback(
    (label?: string, options?: { sections?: SectionsState }) => {
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
      const viewerState: ViewerState = { ...captureViewerState() };
      if (options?.sections) {
        viewerState.sections = options.sections;
      }

      return viewToCameraAnnotation(view, {
        label,
        sceneId: parsed?.manifest.items?.[0]?.id,
        viewerState
      });
    },
    [framing, parsed, presenter, captureViewerState]
  );

  const addComment = useCallback((comment: NewComment) => {
    const id = comment.id ?? createCommentId();
    setComments((current) => [...current, { id, rawLabel: comment.label, text: comment.text, position: comment.position }]);
    return id;
  }, []);

  const updateComment = useCallback((id: string, patch: Partial<Omit<NewComment, 'id'>>) => {
    setComments((current) =>
      current.map((comment) =>
        comment.id === id
          ? {
              ...comment,
              ...(patch.text !== undefined ? { text: patch.text } : {}),
              ...(patch.position !== undefined ? { position: patch.position } : {}),
              ...(patch.label !== undefined ? { rawLabel: patch.label } : {})
            }
          : comment
      )
    );
  }, []);

  const removeComment = useCallback((id: string) => {
    setComments((current) => current.filter((comment) => comment.id !== id));
  }, []);

  const value = useMemo<IIIFContextValue>(
    () => ({
      status,
      error,
      diagnostics,
      parsed,
      metadata: parsed?.metadata ?? null,
      models: parsed?.models ?? [],
      cameras: parsed?.cameras ?? [],
      comments,
      addComment,
      updateComment,
      removeComment,
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
      setModelTransparent,
      isModelTransparent,
      isSolidColorEnabled,
      setSolidColor,
      captureViewerState,
      applyViewerState
    }),
    [
      addComment,
      applyViewerState,
      captureViewerState,
      comments,
      diagnostics,
      error,
      framing,
      goToCamera,
      isModelTransparent,
      isModelVisible,
      isSolidColorEnabled,
      language,
      localize,
      parsed,
      removeComment,
      saveCurrentView,
      scene,
      setLanguage,
      setModelTransparent,
      setModelVisible,
      setSolidColor,
      status,
      toggleModelTransparency,
      updateComment
    ]
  );

  return <IIIFContext.Provider value={value}>{children}</IIIFContext.Provider>;
};
