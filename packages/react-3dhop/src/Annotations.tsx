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
  type AnnotationDefinition
} from './utils/annotations.js';

export type { AnnotationDefinition } from './utils/annotations.js';

export type AnnotationsProps = {
  annotations?: AnnotationDefinition[];
  annotationMeshUrl?: string;
  expanded?: boolean;
  onAnnotationPick?: (event: { id: string; annotation: AnnotationDefinition }) => void;
};

type AnnotationData = AnnotationBuildResult;

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

  const annotationData = useMemo<AnnotationData>(
    () => buildAnnotations(annotations, { idPrefix: 'annotation', meshName: 'spot' }),
    [annotations]
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
  }, [annotationData.spots, resolvedAnnotationMeshUrl, registerSceneContribution, contributionKey, hasSpots]);

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
