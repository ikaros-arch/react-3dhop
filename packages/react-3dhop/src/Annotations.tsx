/**
 * Registers presenter annotations and synchronizes hotspot visibility so React consumers
 * can declaratively add 3DHOP annotation data while reacting to pick events.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import {
  useThreeDHopViewer,
  type AnnotationPickEvent,
  type PresenterInstance,
  type SceneContribution
} from './ThreeDHopViewer.js';
import { joinAssetPath, resolveRelativeAssetPath } from './utils/assetPaths.js';
import { getHopAllTag } from './utils/hopTags.js';
import {
  buildAnnotations,
  type AnnotationBuildResult,
  type AnnotationDefinition,
  type SpotDescriptor
} from './utils/annotations.js';
import { spotTransform } from './geometry/mat4.js';

export type { AnnotationDefinition } from './utils/annotations.js';

export type AnnotationsProps = {
  annotations?: AnnotationDefinition[];
  annotationMeshUrl?: string;
  expanded?: boolean;
  onAnnotationPick?: (event: { id: string; annotation: AnnotationDefinition }) => void;
};

type AnnotationData = AnnotationBuildResult;

/**
 * Many consumers derive `annotations` from broader app state inline in their render (e.g.
 * `.map()`-ing a collection), so a new array - with the same content - arrives on every render
 * that touches *any* of that state, not just the spots themselves. Without this, that reference
 * change would cascade into a new `buildAnnotations()` result below, a `registerSceneContribution`
 * call, and a full `setScene` reload on the presenter - visibly reloading the model (and briefly
 * narrowing or breaking trackball rotation while it re-streams) on every unrelated edit. Comparing
 * by content keeps the returned value referentially stable when nothing meaningful changed.
 */
function useStableAnnotations(annotations: AnnotationDefinition[] | undefined): AnnotationDefinition[] | undefined {
  const cacheRef = useRef<{ signature: string; value: AnnotationDefinition[] | undefined }>({
    signature: '',
    value: annotations
  });
  const signature = annotations ? JSON.stringify(annotations) : '';
  if (signature !== cacheRef.current.signature) {
    cacheRef.current = { signature, value: annotations };
  }
  return cacheRef.current.value;
}

/** A primitive, order-independent fingerprint of a spot id set, cheap to compare in a dep array. */
function spotIdsKey(spots: Record<string, SpotDescriptor> | undefined): string {
  return spots ? Object.keys(spots).sort().join('\u0000') : '';
}

/**
 * Bridges declarative annotation definitions with the imperative presenter API by
 * contributing meshes, wiring toolbar toggles, and dispatching pick callbacks.
 */
export const Annotations: React.FC<AnnotationsProps> = ({
  annotations,
  annotationMeshUrl,
  expanded,
  onAnnotationPick
}) => {
  const {
    presenter,
    assetBaseUrl,
    registerSceneContribution,
    updateSceneContribution,
    registerToolbarAction,
    registerSceneObserver,
    registerAnnotationHandler
  } = useThreeDHopViewer();
  const contributionKey = useId();
  const annotationMapRef = useRef<Map<string, AnnotationDefinition>>(new Map());
  const onAnnotationPickRef = useRef(onAnnotationPick);
  const hotspotVisibleRef = useRef<boolean>(expanded ?? true);

  useEffect(() => {
    onAnnotationPickRef.current = onAnnotationPick;
  }, [onAnnotationPick]);

  const stableAnnotations = useStableAnnotations(annotations);

  const annotationData = useMemo<AnnotationData>(
    () => buildAnnotations(stableAnnotations, { idPrefix: 'annotation', meshName: 'spot' }),
    [stableAnnotations]
  );

  const hasSpots = annotationData.spots != null;

  useEffect(() => {
    annotationMapRef.current = annotationData.map;
  }, [annotationData]);

  const resolvedAnnotationMeshUrl = useMemo(() => {
    if (!annotationData.spots) {
      return undefined;
    }
    const fallbackMesh = joinAssetPath(assetBaseUrl, 'models-system/spot-1.ply');
    return resolveRelativeAssetPath(annotationMeshUrl, assetBaseUrl, fallbackMesh);
  }, [annotationData.spots, annotationMeshUrl, assetBaseUrl]);

  useEffect(() => {
    if (!hasSpots) {
      hotspotVisibleRef.current = false;
      window.hotspotSwitch?.(false);
    }
  }, [hasSpots]);

  useEffect(() => {
    if (expanded == null) {
      return;
    }
    hotspotVisibleRef.current = expanded;
    if (presenter && hasSpots) {
      presenter.setSpotVisibility?.(getHopAllTag(), expanded, true);
      presenter.enableOnHover?.(expanded);
      window.hotspotSwitch?.(expanded);
      presenter.ui?.postDrawEvent?.();
    }
  }, [expanded, presenter, hasSpots]);

  // Registers/unregisters the scene contribution - the "structural" operation that needs a real
  // `setScene` (new spot meshes to create, or none left). Deliberately keyed on the *shape*
  // (which ids exist, which mesh) rather than `annotationData.spots` itself: a `useEffect`'s
  // cleanup from the previous render always runs before the next invocation, so keying this on
  // spot *content* would delete-then-re-add (and so reload the model) on every property-only
  // change, such as dragging a spot's colour picker - exactly what the effect below exists to
  // avoid. Property changes to already-registered spots are synced by the effect below instead.
  const idsKey = spotIdsKey(annotationData.spots);

  useEffect(() => {
    if (!hasSpots) {
      return registerSceneContribution(contributionKey, null);
    }

    const contribution: SceneContribution = {
      spots: annotationData.spots,
      annotations: Object.fromEntries(annotationData.map)
    };

    if (resolvedAnnotationMeshUrl) {
      contribution.meshes = {
        spot: { url: resolvedAnnotationMeshUrl }
      };
    }

    return registerSceneContribution(contributionKey, contribution);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on idsKey, not annotationData.spots; see comment above.
  }, [idsKey, resolvedAnnotationMeshUrl, registerSceneContribution, contributionKey, hasSpots]);

  // Keeps the registered contribution's record fresh for whenever a *later*, full rebuild happens
  // for an unrelated reason, and - since 3DHOP's spot draw call reads color/alpha/transform.matrix
  // straight off the live scene object on every frame rather than baking it in at `setScene` time -
  // applies the same values directly to the presenter's already-live spots and requests a repaint.
  // No full reload needed for a property-only change to spots that already exist.
  useEffect(() => {
    if (!hasSpots) {
      return;
    }

    const spots = annotationData.spots as Record<string, SpotDescriptor>;
    const contribution: SceneContribution = {
      spots,
      annotations: Object.fromEntries(annotationData.map)
    };
    if (resolvedAnnotationMeshUrl) {
      contribution.meshes = {
        spot: { url: resolvedAnnotationMeshUrl }
      };
    }
    updateSceneContribution(contributionKey, contribution);

    const liveSpots = presenter?._scene?.spots;
    if (!liveSpots) {
      return;
    }
    let patchedAny = false;
    for (const [id, next] of Object.entries(spots)) {
      const target = liveSpots[id];
      if (!target) continue;
      target.color = next.color;
      target.alpha = next.alpha;
      target.alphaHigh = next.alphaHigh;
      target.transform = { matrix: spotTransform(next.transform.translation, next.transform.scale) };
      patchedAny = true;
    }
    if (patchedAny) {
      presenter?.repaint?.() ?? presenter?.ui?.postDrawEvent?.();
    }
  }, [annotationData.spots, annotationData.map, resolvedAnnotationMeshUrl, updateSceneContribution, contributionKey, hasSpots, presenter]);

  /**
   * Applies the requested hotspot visibility to the presenter while updating legacy 3DHOP
   * globals so toolbar buttons and UI overlays stay in sync.
   */
  const applyHotspotState = useCallback((presenterInstance: PresenterInstance, visible: boolean) => {
    presenterInstance.setSpotVisibility?.(getHopAllTag(), visible, true);
    presenterInstance.enableOnHover?.(visible);
    window.hotspotSwitch?.(visible);
    presenterInstance.ui?.postDrawEvent?.();
  }, []);

  useEffect(() => {
    if (!hasSpots) {
      return undefined;
    }

    return registerToolbarAction(['hotspot', 'hotspot_on'], (presenterInstance) => {
      const nextVisible = !hotspotVisibleRef.current;
      hotspotVisibleRef.current = nextVisible;
      applyHotspotState(presenterInstance, nextVisible);
      return true;
    });
  }, [applyHotspotState, hasSpots, registerToolbarAction]);

  useEffect(() => {
    if (!hasSpots) {
      return undefined;
    }

    return registerSceneObserver((presenterInstance) => {
      applyHotspotState(presenterInstance, hotspotVisibleRef.current);
    });
  }, [applyHotspotState, hasSpots, registerSceneObserver]);

  useEffect(() => {
    const cleanup = registerAnnotationHandler((event: AnnotationPickEvent) => {
      if (!annotationMapRef.current.has(event.id)) {
        return;
      }
      onAnnotationPickRef.current?.(event);
    });

    return cleanup;
  }, [registerAnnotationHandler]);

  useEffect(() => {
    const presenterInstance = presenter;
    if (!presenterInstance || !hasSpots) {
      return;
    }
    applyHotspotState(presenterInstance, hotspotVisibleRef.current);
  }, [applyHotspotState, presenter, hasSpots]);

  return null;
};
