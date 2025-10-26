import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { useThreeDHopViewer, type PresenterInstance, type SceneContribution } from './ThreeDHopViewer.js';
import { joinAssetPath, resolveRelativeAssetPath } from './utils/assetPaths.js';
import { getHopAllTag } from './utils/hopTags.js';

type AnnotationColor = [number, number, number];

export type AnnotationDefinition = {
  id?: string;
  label?: string;
  comment?: string;
  position: [number, number, number];
  type?: string;
  radius?: number;
  color?: AnnotationColor | string;
  alpha?: number;
  alphaHigh?: number;
  useTransparency?: boolean;
  useStencil?: boolean;
  tags?: string[];
};

export type AnnotationsProps = {
  annotations?: AnnotationDefinition[];
  annotationMeshUrl?: string;
  expanded?: boolean;
  onAnnotationPick?: (event: { id: string; annotation: AnnotationDefinition }) => void;
};

type AnnotationData = {
  spots?: Record<string, unknown>;
  map: Map<string, AnnotationDefinition>;
};

const DEFAULT_ANNOTATION_COLOR: AnnotationColor = [1, 0.76, 0.04];
const DEFAULT_ANNOTATION_RADIUS = 0.5;

function normalizeColor(input: AnnotationDefinition['color']): AnnotationColor {
  if (!input) {
    return DEFAULT_ANNOTATION_COLOR;
  }

  const asArray = Array.isArray(input)
    ? input
    : (() => {
        try {
          const parsed = JSON.parse(input);
          return Array.isArray(parsed) ? parsed : null;
        } catch (error) {
          return null;
        }
      })();

  if (!asArray || asArray.length < 3) {
    return DEFAULT_ANNOTATION_COLOR;
  }

  const [r, g, b] = asArray;
  const safe = (value: unknown, fallback = 0): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  return [safe(r, DEFAULT_ANNOTATION_COLOR[0]), safe(g, DEFAULT_ANNOTATION_COLOR[1]), safe(b, DEFAULT_ANNOTATION_COLOR[2])];
}

function safeRadius(value: AnnotationDefinition['radius']): number {
  if (typeof value !== 'number') {
    return DEFAULT_ANNOTATION_RADIUS;
  }
  return value > 0 ? value : DEFAULT_ANNOTATION_RADIUS;
}

export const Annotations: React.FC<AnnotationsProps> = ({
  annotations,
  annotationMeshUrl,
  expanded,
  onAnnotationPick
}) => {
  const { presenter, assetBaseUrl, registerSceneContribution, registerToolbarAction, registerSceneObserver } =
    useThreeDHopViewer();
  const contributionKey = useId();
  const annotationMapRef = useRef<Map<string, AnnotationDefinition>>(new Map());
  const onAnnotationPickRef = useRef(onAnnotationPick);
  const previousOnPickedSpotRef = useRef<PresenterInstance['_onPickedSpot']>();
  const hotspotVisibleRef = useRef<boolean>(expanded ?? true);

  useEffect(() => {
    onAnnotationPickRef.current = onAnnotationPick;
  }, [onAnnotationPick]);

  const annotationData = useMemo<AnnotationData>(() => {
    if (!annotations || annotations.length === 0) {
      return {
        spots: undefined,
        map: new Map<string, AnnotationDefinition>()
      };
    }

    const map = new Map<string, AnnotationDefinition>();
    const spots: Record<string, unknown> = {};

    for (let index = 0; index < annotations.length; index += 1) {
      const annotationEntry = annotations[index];
      if (!annotationEntry || !Array.isArray(annotationEntry.position) || annotationEntry.position.length < 3) {
        continue;
      }

      const id = annotationEntry.id ?? `annotation_${index + 1}`;
      map.set(id, annotationEntry);

      const radius = safeRadius(annotationEntry.radius);
      const [x, y, z] = annotationEntry.position;
      const tags = annotationEntry.tags ?? (annotationEntry.type ? [annotationEntry.type] : undefined);

      spots[id] = {
        mesh: 'spot',
        color: normalizeColor(annotationEntry.color),
        alpha: typeof annotationEntry.alpha === 'number' ? annotationEntry.alpha : 0.5,
        alphaHigh: typeof annotationEntry.alphaHigh === 'number' ? annotationEntry.alphaHigh : 0.8,
        useTransparency: annotationEntry.useTransparency ?? true,
        useStencil: annotationEntry.useStencil ?? true,
        tags,
        transform: {
          translation: [x, y, z],
          scale: [radius, radius, radius]
        }
      };
    }

    return {
      spots: Object.keys(spots).length > 0 ? spots : undefined,
      map
    };
  }, [annotations]);

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
      spots: annotationData.spots
    };

    if (resolvedAnnotationMeshUrl) {
      contribution.meshes = {
        spot: { url: resolvedAnnotationMeshUrl }
      };
    }

    return registerSceneContribution(contributionKey, contribution);
  }, [annotationData.spots, resolvedAnnotationMeshUrl, registerSceneContribution, contributionKey, hasSpots]);

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
    const presenterInstance = presenter;
    if (!presenterInstance || !hasSpots) {
      return undefined;
    }

    previousOnPickedSpotRef.current = presenterInstance._onPickedSpot;

    presenterInstance._onPickedSpot = (id: string) => {
      const annotation = annotationMapRef.current.get(id);
      if (!annotation) {
        return;
      }

      onAnnotationPickRef.current?.({
        id,
        annotation
      });
    };

    applyHotspotState(presenterInstance, hotspotVisibleRef.current);

    return () => {
      if (previousOnPickedSpotRef.current !== undefined) {
        presenterInstance._onPickedSpot = previousOnPickedSpotRef.current;
        previousOnPickedSpotRef.current = undefined;
      }
    };
  }, [applyHotspotState, presenter, hasSpots]);

  return null;
};
