import type { ModelDefinition, SceneRenderConfig, SceneSpaceConfig, TrackballConfig } from 'react-3dhop';
import { buildModelMatrix } from './transforms.js';
import { getUnitScaleFactor } from './units.js';
import type { ParsedManifest, ParsedModel } from './types.js';

/** Unit assumed when a manifest declares none. Matches the original viewer's behaviour. */
export const DEFAULT_MEASURE_UNIT = 'mm';

export type SceneFromManifest = {
  models: Record<string, ModelDefinition>;
  space: SceneSpaceConfig;
  config: SceneRenderConfig;
  trackball: TrackballConfig;
  /** The unit the scene's coordinates are now in — what measurements should be labelled with. */
  displayUnit: string;
  measureUnit: string;
  /** Maps each generated instance key back to the IIIF annotation it came from. */
  instanceIdsByModelId: Record<string, string>;
};

export type ToModelsOptions = {
  /** Overrides the manifest's `display unit` metadata. */
  displayUnit?: string;
  /** Merged over the defaults derived from the manifest. */
  space?: SceneSpaceConfig;
  config?: SceneRenderConfig;
  trackball?: TrackballConfig;
};

function sanitizeKey(value: string, fallback: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Translates a parsed manifest into the props `<ThreeDHopViewer>` needs.
 *
 * Models sharing a source URL are collapsed onto a single mesh, so a manifest that places the same
 * object several times downloads it once.
 */
export function sceneFromManifest(parsed: ParsedManifest, options: ToModelsOptions = {}): SceneFromManifest {
  const measureUnit = parsed.metadata.measureUnit?.trim() || DEFAULT_MEASURE_UNIT;
  const displayUnit = options.displayUnit?.trim() || parsed.metadata.displayUnit?.trim() || measureUnit;

  const sceneScale = getUnitScaleFactor(measureUnit, displayUnit);

  const models: Record<string, ModelDefinition> = {};
  const instanceIdsByModelId: Record<string, string> = {};
  const meshIdByUrl = new Map<string, string>();
  const usedKeys = new Set<string>();

  parsed.models.forEach((model: ParsedModel, index: number) => {
    let meshId = meshIdByUrl.get(model.url);
    if (!meshId) {
      meshId = `iiif_mesh_${meshIdByUrl.size}`;
      meshIdByUrl.set(model.url, meshId);
    }

    let key = sanitizeKey(model.id, `iiif_model_${index}`);
    while (usedKeys.has(key)) {
      key = `${key}_${index}`;
    }
    usedKeys.add(key);

    const geometryScale = model.measureUnit
      ? getUnitScaleFactor(model.measureUnit, displayUnit)
      : sceneScale;

    models[key] = {
      url: model.url,
      meshId,
      transform: {
        matrix: buildModelMatrix({
          position: model.position,
          transforms: model.transforms,
          sceneScale,
          geometryScale
        })
      },
      tags: ['SPECIMEN'],
      color: [0.5, 0.5, 0.5],
      backfaceColor: [0.5, 0.5, 0.5, 3.0],
      specularColor: [0.0, 0.0, 0.0, 256.0]
    };

    instanceIdsByModelId[model.id] = key;
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
    // A half-unit clipping border is invisible on a millimetre-scale object and enormous on a
    // metre-scale one, so the metre case gets its own value.
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

  return { models, space, config, trackball, displayUnit, measureUnit, instanceIdsByModelId };
}
