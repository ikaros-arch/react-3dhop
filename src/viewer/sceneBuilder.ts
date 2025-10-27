import { joinAssetPath, resolveRelativeAssetPath } from '../utils/assetPaths.js';
import { buildAnnotations, type AnnotationDefinition } from '../utils/annotations.js';
import type {
  ModelDefinition,
  ModelInstanceConfiguration,
  SceneConfiguration,
  SceneContribution,
  SceneMeshes
} from './types.js';

function sanitizeIdentifier(value: string, fallback: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized.length > 0 ? sanitized : fallback;
}

function ensureUniqueName(base: string, used: Set<string>): string {
  let candidate = base;
  let index = 1;
  while (used.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function normalizeScale(scale?: number | [number, number, number]): [number, number, number] | undefined {
  if (scale == null) {
    return undefined;
  }

  if (typeof scale === 'number') {
    const numeric = Number(scale);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }
    return [numeric, numeric, numeric];
  }

  if (Array.isArray(scale) && scale.length >= 3) {
    const values: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 3; i += 1) {
      const numeric = Number(scale[i]);
      values[i] = Number.isFinite(numeric) ? numeric : 1;
    }
    return values;
  }

  return undefined;
}

const PLY_RENDER_MODE = ['POINT'] as const;
const NEXUS_RENDER_MODE = ['FILL', 'POINT'] as const;

type SceneBuilderOptions = {
  models: Record<string, ModelDefinition | null | undefined> | undefined;
  normalizedBaseUrl: string;
  resolvedModelUrl: string;
  sceneContributions: Map<string, SceneContribution>;
};

type SceneBuildResult = {
  scene: SceneConfiguration;
  annotationDefinitions: Map<string, AnnotationDefinition>;
  hasHotspots: boolean;
};

function createMeshDefinition(url: string) {
  const lower = url.toLowerCase().split(/[?#]/)[0];
  if (lower.endsWith('.ply')) {
    return {
      url,
      renderMode: [...PLY_RENDER_MODE],
      mType: 'ply' as const
    } satisfies SceneMeshes[string];
  }

  return {
    url,
    renderMode: [...NEXUS_RENDER_MODE],
    mType: 'nexus' as const
  } satisfies SceneMeshes[string];
}

export function buildSceneConfiguration(options: SceneBuilderOptions): SceneBuildResult {
  const { models, normalizedBaseUrl, resolvedModelUrl, sceneContributions } = options;

  const meshes: SceneMeshes = {};
  const modelInstances: Record<string, ModelInstanceConfiguration> = {};
  const usedMeshNames = new Set<string>();
  const usedInstanceNames = new Set<string>();
  const annotationDefinitions = new Map<string, AnnotationDefinition>();
  const meshUrlCounts = new Map<string, number>();

  let spots: Record<string, unknown> | undefined;

  const assignUniqueMeshUrl = (url: string, meshName: string): string => {
    const [base] = url.split('#');
    const currentCount = meshUrlCounts.get(base) ?? 0;
    meshUrlCounts.set(base, currentCount + 1);
    if (currentCount === 0) {
      return url;
    }

    const fragment = encodeURIComponent(meshName);
    if (url.includes('#')) {
      return `${url}_${fragment}`;
    }
    return `${url}#${fragment}`;
  };

  const addMesh = (name: string, meshUrl: string) => {
    const uniqueUrl = assignUniqueMeshUrl(meshUrl, name);
    meshes[name] = createMeshDefinition(uniqueUrl);
    usedMeshNames.add(name);
  };

  const modelEntries = models ? Object.entries(models) : [];

  const processModelDefinition = (entryKey: string, definition: ModelDefinition | null | undefined, index: number) => {
    if (!definition) {
      return;
    }

    const safeKey = sanitizeIdentifier(entryKey, `model_${index + 1}`);

    const meshBaseName = definition.meshId ?? `mesh_${safeKey}`;
    const meshName = ensureUniqueName(meshBaseName, usedMeshNames);
    const resolvedUrl = resolveRelativeAssetPath(definition.url, normalizedBaseUrl, resolvedModelUrl);
    addMesh(meshName, resolvedUrl);

    const instanceBaseName = definition.instanceId ?? `model_${safeKey}`;
    const instanceName = ensureUniqueName(instanceBaseName, usedInstanceNames);

    const instance: ModelInstanceConfiguration = {
      mesh: meshName,
      ...(definition.instance ? { ...definition.instance } : {})
    };

    if (definition.transform) {
      instance.transform = {
        ...(instance.transform ?? {}),
        ...definition.transform
      };
    }

    const normalizedScale = normalizeScale(definition.scale);
    if (normalizedScale) {
      instance.transform = {
        ...(instance.transform ?? {}),
        scale: normalizedScale
      };
    }

    if (definition.color) {
      instance.color = [...definition.color];
    }
    if (definition.backfaceColor) {
      instance.backfaceColor = [...definition.backfaceColor];
    }
    if (definition.specularColor) {
      instance.specularColor = [...definition.specularColor];
    }
    if (definition.tags) {
      instance.tags = [...definition.tags];
    }
    if (typeof definition.visible === 'boolean') {
      instance.visible = definition.visible;
    }
    if (typeof definition.useSolidColor === 'boolean') {
      instance.useSolidColor = definition.useSolidColor;
    }
    if (typeof definition.alpha === 'number') {
      instance.alpha = definition.alpha;
    }
    if (definition.transparency !== undefined) {
      if (typeof definition.transparency === 'boolean') {
        instance.useTransparency = definition.transparency;
      } else if (definition.transparency) {
        instance.useTransparency = definition.transparency.enabled ?? true;
        if (typeof definition.transparency.alpha === 'number') {
          instance.alpha = definition.transparency.alpha;
        }
      }
    }

    modelInstances[instanceName] = instance;

    if (definition.annotations && definition.annotations.length > 0) {
      const annotationMeshBase = `${instanceName}_spot`;
      const annotationMeshName = ensureUniqueName(annotationMeshBase, usedMeshNames);
      const resolvedAnnotationMeshUrl = resolveRelativeAssetPath(
        definition.annotationMeshUrl,
        normalizedBaseUrl,
        joinAssetPath(normalizedBaseUrl, 'models-system/spot-1.ply')
      );
      addMesh(annotationMeshName, resolvedAnnotationMeshUrl);

      const annotationData = buildAnnotations(definition.annotations, {
        idPrefix: instanceName,
        meshName: annotationMeshName
      });

      if (annotationData.spots) {
        spots = {
          ...(spots ?? {}),
          ...annotationData.spots
        };
      }

      annotationData.map.forEach((value, id) => {
        annotationDefinitions.set(id, value);
      });
    }
  };

  if (modelEntries.length > 0) {
    modelEntries.forEach(([key, definition], index) => {
      processModelDefinition(key, definition, index);
    });
  } else {
    const meshName = ensureUniqueName('mesh_1', usedMeshNames);
    addMesh(meshName, resolvedModelUrl);
    const instanceName = ensureUniqueName('model_1', usedInstanceNames);
    modelInstances[instanceName] = { mesh: meshName };
  }

  sceneContributions.forEach((contribution) => {
    if (contribution.meshes) {
      Object.assign(meshes, contribution.meshes);
    }
    if (contribution.modelInstances) {
      Object.assign(modelInstances, contribution.modelInstances);
    }
    if (contribution.spots) {
      spots = {
        ...(spots ?? {}),
        ...contribution.spots
      };
    }
    if (contribution.annotations) {
      Object.entries(contribution.annotations).forEach(([id, definition]) => {
        annotationDefinitions.set(id, definition);
      });
    }
  });

  const scene: SceneConfiguration = {
    meshes,
    modelInstances,
    trackball: {
      type: window.TurnTableTrackball,
      trackOptions: {
        startPhi: 35.0,
        startTheta: 15.0,
        startDistance: 2.5,
        minMaxPhi: [-180, 180],
        minMaxTheta: [-30.0, 70.0],
        minMaxDist: [0.5, 3.0]
      }
    }
  };

  if (spots) {
    scene.spots = spots;
  }

  return {
    scene,
    annotationDefinitions,
    hasHotspots: Boolean(scene.spots && Object.keys(scene.spots).length > 0)
  };
}
