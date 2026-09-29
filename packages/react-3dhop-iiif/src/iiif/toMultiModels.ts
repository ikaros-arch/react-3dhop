import type { ModelDefinition, SceneRenderConfig, SceneSpaceConfig, TrackballConfig } from '@ikaros-arch/react-3dhop';
import { multiply, translation } from './mat4.js';
import { sceneFromManifest } from './toModels.js';
import type { ParsedManifest, ParsedModel, Vector3 } from './types.js';

export type ManifestSceneEntry = {
  /** Sanitized id for this manifest, unique within the merged scene. Used to namespace model keys
   *  and to disambiguate per-manifest visibility/transparency state. */
  key: string;
  /** The manifest's own id/URL, kept for display/debugging. */
  sourceId: string;
  parsed: ParsedManifest;
  /** `parsed.models`, unmodified — for panels that need per-model metadata/labels. */
  models: ParsedModel[];
  /** IIIF annotation id -> globally-unique instance key in the merged `models` record. */
  instanceIdsByModelId: Record<string, string>;
  /** World-space offset applied to every model belonging to this manifest, in the shared displayUnit. */
  offset: Vector3;
  /** Placement-spread radius used to compute `offset`. Exposed for debugging/tests. */
  layoutRadius: number;
};

export type SceneFromManifests = {
  models: Record<string, ModelDefinition>;
  space: SceneSpaceConfig;
  config: SceneRenderConfig;
  trackball: TrackballConfig;
  displayUnit: string;
  measureUnit: string;
  manifests: ManifestSceneEntry[];
};

export type ToMultiModelsOptions = {
  /** Shared display unit every manifest is converted into. Defaults to the first manifest's. */
  displayUnit?: string;
  space?: SceneSpaceConfig;
  config?: SceneRenderConfig;
  trackball?: TrackballConfig;
  /** Gap kept between adjacent manifests' layout circles, in the shared displayUnit. Default 50. */
  gap?: number;
  /**
   * Floor applied to every manifest's placement-spread radius.
   *
   * There is no real mesh geometry size available at this point — meshes stream in later, and the
   * manifest only tells us where each annotation is *placed*, not how big it is. Most manifests
   * place a single model at the origin, which has a spread of 0; without this floor every such
   * manifest would land on top of the others. Tune this per dataset. Default 100.
   */
  minRadius?: number;
  /** Manifests per row before wrapping onto a new row. Default: unlimited (single row). */
  columns?: number;
  /** Escape hatch: an explicit offset per manifest key, skipping automatic layout for that manifest. */
  layoutOverrides?: Record<string, Vector3>;
};

function sanitizeKey(value: string, fallback: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Radius of the smallest circle centred on the centroid that covers every model's placement. */
function placementSpreadRadius(models: ParsedModel[]): number {
  if (models.length <= 1) {
    return 0;
  }

  const centroid = models.reduce<Vector3>(
    (sum, model) => [sum[0] + model.position[0], sum[1] + model.position[1], sum[2] + model.position[2]],
    [0, 0, 0]
  );
  centroid[0] /= models.length;
  centroid[1] /= models.length;
  centroid[2] /= models.length;

  return models.reduce((max, model) => Math.max(max, Math.hypot(
    model.position[0] - centroid[0],
    model.position[1] - centroid[1],
    model.position[2] - centroid[2]
  )), 0);
}

/**
 * Arranges circles of the given radii on the X/Z plane, packed left-to-right and wrapped every
 * `columns` entries, each separated by `gap`. Returns one offset per input radius, re-centred so
 * the layout's bounding box sits on the origin (cosmetic only — `centerMode: 'scene'` reframes the
 * camera around the actual rendered geometry regardless).
 */
export function layoutManifests(radii: number[], options: { gap: number; columns: number }): Vector3[] {
  const { gap, columns } = options;
  const offsets: Vector3[] = [];

  let cursorX = 0;
  let cursorZ = 0;
  let rowMaxRadius = 0;
  let previousRadius = 0;

  radii.forEach((radius, index) => {
    const column = columns > 0 ? index % columns : index;
    if (column === 0 && index > 0) {
      cursorZ += rowMaxRadius + gap + radius;
      cursorX = 0;
      rowMaxRadius = 0;
      previousRadius = 0;
    } else if (index > 0) {
      cursorX += previousRadius + gap + radius;
    }

    offsets.push([cursorX, 0, cursorZ]);
    rowMaxRadius = Math.max(rowMaxRadius, radius);
    previousRadius = radius;
  });

  if (offsets.length === 0) {
    return offsets;
  }

  const minX = Math.min(...offsets.map((offset) => offset[0]));
  const maxX = Math.max(...offsets.map((offset) => offset[0]));
  const minZ = Math.min(...offsets.map((offset) => offset[2]));
  const maxZ = Math.max(...offsets.map((offset) => offset[2]));
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return offsets.map(([x, y, z]) => [x - centerX, y, z - centerZ]);
}

/**
 * Translates several parsed manifests into the props `<ThreeDHopViewer>` needs for a single,
 * combined scene — one manifest per `ParsedManifest`, laid out side by side so their models don't
 * overlap even when their native coordinates coincide (see {@link ToMultiModelsOptions.minRadius}).
 *
 * Delegates all per-manifest unit conversion and matrix building to {@link sceneFromManifest}, then
 * re-keys and offsets the result so it can be merged into one flat model dictionary.
 */
export function sceneFromManifests(
  parsedList: ParsedManifest[],
  sourceIds: string[],
  options: ToMultiModelsOptions = {}
): SceneFromManifests {
  const gap = options.gap ?? 50;
  const minRadius = options.minRadius ?? 100;
  const columns = options.columns ?? parsedList.length;
  const displayUnit =
    options.displayUnit?.trim() || parsedList[0]?.metadata.displayUnit?.trim() || parsedList[0]?.metadata.measureUnit?.trim() || 'mm';

  const perManifestScenes = parsedList.map((parsed) => sceneFromManifest(parsed, { displayUnit }));
  const radii = perManifestScenes.map((_, index) =>
    Math.max(minRadius, placementSpreadRadius(parsedList[index].models))
  );
  const autoOffsets = layoutManifests(radii, { gap, columns });

  const models: Record<string, ModelDefinition> = {};
  const usedManifestKeys = new Set<string>();
  const manifests: ManifestSceneEntry[] = [];

  parsedList.forEach((parsed, index) => {
    const sourceId = sourceIds[index] ?? `manifest_${index}`;
    let manifestKey = sanitizeKey(parsed.manifest.id ?? sourceId, `manifest_${index}`);
    while (usedManifestKeys.has(manifestKey)) {
      manifestKey = `${manifestKey}_${index}`;
    }
    usedManifestKeys.add(manifestKey);

    const offset = options.layoutOverrides?.[manifestKey] ?? autoOffsets[index] ?? [0, 0, 0];
    const offsetMatrix = translation(offset);

    const manifestScene = perManifestScenes[index];
    const instanceIdsByModelId: Record<string, string> = {};

    Object.entries(manifestScene.models).forEach(([localKey, modelDef]) => {
      const globalKey = `${manifestKey}__${localKey}`;
      models[globalKey] = {
        ...modelDef,
        meshId: `${manifestKey}__${modelDef.meshId}`,
        instanceId: globalKey,
        transform: {
          matrix: multiply(offsetMatrix, modelDef.transform!.matrix!)
        }
      };
    });

    Object.entries(manifestScene.instanceIdsByModelId).forEach(([modelId, localKey]) => {
      instanceIdsByModelId[modelId] = `${manifestKey}__${localKey}`;
    });

    manifests.push({
      key: manifestKey,
      sourceId,
      parsed,
      models: parsed.models,
      instanceIdsByModelId,
      offset,
      layoutRadius: radii[index]
    });
  });

  const space: SceneSpaceConfig = {
    centerMode: 'scene',
    radiusMode: 'scene',
    cameraNearFar: [0.01, 5.0],
    ...options.space
  };

  const config: SceneRenderConfig = {
    pickedpointColor: [1.0, 0.0, 1.0],
    measurementColor: [0.5, 1.0, 0.5],
    showClippingPlanes: true,
    showClippingBorder: true,
    clippingBorderSize: displayUnit === 'm' ? 0.002 : 0.5,
    clippingBorderColor: [0.0, 1.0, 1.0],
    ...options.config
  };

  const trackball: TrackballConfig = {
    type: 'TurntablePanTrackball',
    ...options.trackball,
    trackOptions: {
      startPhi: 15.0,
      startTheta: 15.0,
      startDistance: 2.0,
      minMaxPhi: [-180, 180],
      minMaxTheta: [-90.0, 90.0],
      minMaxDist: [0.1, 3.0],
      ...options.trackball?.trackOptions
    }
  };

  return { models, space, config, trackball, displayUnit, measureUnit: displayUnit, manifests };
}
