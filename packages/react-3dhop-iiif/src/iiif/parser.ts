import { collectLanguages, resolveLanguageMap } from './language.js';
import type {
  DiagnosticHandler,
  IIIFAnnotation,
  IIIFAnnotationBody,
  IIIFAnnotationTarget,
  IIIFManifest,
  IIIFModelSource,
  IIIFPointSelector,
  LocalizableValue,
  ParsedCamera,
  ParsedManifest,
  ParsedMetadata,
  ParsedModel,
  Vector3
} from './types.js';

/**
 * Ranking used when an annotation offers the same model in several formats. Nexus wins because it
 * is the only one 3DHOP streams progressively; glTF ranks last because 3DHOP cannot load it at all
 * and it is only ever a fallback worth reporting.
 */
export const FORMAT_PREFERENCE: Record<string, number> = {
  glb: 1,
  gltf: 1,
  'model/gltf-binary': 1,
  'model/gltf+json': 1,
  obj: 2,
  'model/obj': 2,
  ply: 3,
  'application/ply': 3,
  nexus: 4,
  nxz: 4,
  nxs: 4,
  'application/octet-stream+nexus': 4
};

function first<T>(value: T | T[] | undefined | null): T | undefined {
  if (Array.isArray(value)) {
    return value.length > 0 ? value[0] : undefined;
  }
  return value ?? undefined;
}

function toVector3(selector: IIIFPointSelector | undefined): Vector3 {
  return [selector?.x ?? 0, selector?.y ?? 0, selector?.z ?? 0];
}

/** Reads the first `PointSelector` reachable from an annotation target. */
function readPointSelector(target: IIIFAnnotation['target']): IIIFPointSelector | undefined {
  if (!target || typeof target === 'string') {
    return undefined;
  }

  const entry = first<IIIFAnnotationTarget>(target as IIIFAnnotationTarget | IIIFAnnotationTarget[]);
  const selector = first(entry?.selector);

  return selector?.type === 'PointSelector' || selector?.x !== undefined ? selector : undefined;
}

/**
 * A `SpecificResource` body always counts as a model here: in the IIIF 3D subset this package
 * supports it exists only to wrap a model with a transform list. Claiming it even when its `source`
 * is missing or empty means the annotation is reported as an unusable model rather than as an
 * unrecognised body type, which is the more useful message for what is really an authoring slip.
 */
function isModelBody(body: IIIFAnnotationBody | undefined): boolean {
  return body?.type === 'Model' || body?.type === 'SpecificResource';
}

function isCameraBody(body: IIIFAnnotationBody | undefined): boolean {
  return body?.type === 'PerspectiveCamera' || body?.type === 'OrthographicCamera';
}

/** Picks the source this viewer can make the best use of. See {@link FORMAT_PREFERENCE}. */
export function selectBestSource(
  source: IIIFModelSource | IIIFModelSource[] | undefined
): IIIFModelSource | undefined {
  if (!source) {
    return undefined;
  }
  if (!Array.isArray(source)) {
    return source;
  }
  if (source.length <= 1) {
    return source[0];
  }

  const rank = (candidate: IIIFModelSource) => FORMAT_PREFERENCE[(candidate.format ?? '').toLowerCase()] ?? 0;

  return [...source].sort((a, b) => rank(b) - rank(a))[0];
}

/**
 * Metadata labels lifted into dedicated fields, keyed by their lowercased English or Norwegian
 * label. Everything else stays in `metadata.fields` untouched.
 */
const KNOWN_FIELDS: Record<string, keyof ParsedMetadata> = {
  museum: 'museum',
  'inventory number': 'inventory',
  inventarnummer: 'inventory',
  'object id': 'objectId',
  'objekt-id': 'objectId',
  'measure unit': 'measureUnit',
  'måleenhet': 'measureUnit',
  'display unit': 'displayUnit',
  visningsenhet: 'displayUnit'
};

export type ParseOptions = {
  /** Language used to resolve labels and values. Defaults to `'en'`. */
  language?: string;
  onDiagnostic?: DiagnosticHandler;
};

function parseMetadata(manifest: IIIFManifest, language: string): ParsedMetadata {
  const resolve = (value: LocalizableValue | undefined) => resolveLanguageMap(value, language);

  const metadata: ParsedMetadata = {
    label: resolve(manifest.label),
    fields: []
  };

  const summary = resolve(manifest.summary);
  if (summary) {
    metadata.summary = summary;
  }

  const attribution = resolve(manifest.requiredStatement?.value);
  if (attribution) {
    metadata.attribution = attribution;
  }

  (manifest.metadata ?? []).forEach((entry) => {
    const localizedLabel = resolve(entry.label);
    const value = resolve(entry.value);

    metadata.fields.push({ label: localizedLabel, value });

    // Recognised fields are matched on the English label so the mapping survives a language switch.
    const canonicalKey = resolveLanguageMap(entry.label, 'en').trim().toLowerCase();
    const known = KNOWN_FIELDS[canonicalKey];
    if (known) {
      (metadata as Record<string, unknown>)[known] = value;
    }
  });

  return metadata;
}

function parseModelAnnotation(
  annotation: IIIFAnnotation,
  body: IIIFAnnotationBody,
  onDiagnostic?: DiagnosticHandler
): ParsedModel | undefined {
  let url: string | undefined;
  let format: string | undefined;
  let measureUnit: string | undefined;
  let transforms: ParsedModel['transforms'] = [];

  if (body.type === 'Model') {
    url = body.id;
    format = body.format;
    measureUnit = body.measureUnit;
  } else {
    const source = selectBestSource(body.source);
    if (!source) {
      onDiagnostic?.({
        level: 'warning',
        message: `Model annotation ${annotation.id ?? '(no id)'} has no usable source; skipping.`
      });
      return undefined;
    }
    url = source.id;
    format = source.format;
    measureUnit = source.measureUnit ?? body.measureUnit;

    if (Array.isArray(body.transform)) {
      transforms = body.transform;
    }
  }

  if (!url) {
    onDiagnostic?.({
      level: 'warning',
      message: `Model annotation ${annotation.id ?? '(no id)'} has no source URL; skipping.`
    });
    return undefined;
  }

  // 3DHOP only has loaders for Nexus and PLY. Anything else is reported here rather than failing
  // silently at load time with nothing on screen to explain it.
  const normalizedFormat = (format ?? '').toLowerCase();
  const unrenderable = normalizedFormat.includes('gltf')
    ? 'glTF'
    : normalizedFormat === 'glb' || normalizedFormat === 'model/gltf-binary'
      ? 'glTF'
      : normalizedFormat === 'obj' || normalizedFormat === 'model/obj'
        ? 'OBJ'
        : undefined;

  if (unrenderable) {
    onDiagnostic?.({
      level: 'warning',
      message: `Model ${url} is ${unrenderable}, which 3DHOP cannot render. Convert it to Nexus (.nxz) or PLY.`
    });
  }

  return {
    id: annotation.id ?? url,
    rawLabel: annotation.label,
    url,
    format,
    measureUnit,
    position: toVector3(readPointSelector(annotation.target)),
    transforms
  };
}

function parseCameraAnnotation(annotation: IIIFAnnotation, body: IIIFAnnotationBody): ParsedCamera {
  const camera: ParsedCamera = {
    id: body.id,
    type: body.type === 'OrthographicCamera' ? 'OrthographicCamera' : 'PerspectiveCamera',
    rawLabel: body.label ?? annotation.label,
    position: toVector3(readPointSelector(annotation.target))
  };

  const fov = body.fieldOfView ?? body.fov;
  if (typeof fov === 'number') {
    camera.fov = fov;
  }

  if (body.lookAt) {
    // `lookAt` is either a point in space or a reference to another annotation.
    if (body.lookAt.type === 'PointSelector' || body.lookAt.x !== undefined) {
      camera.target = toVector3(body.lookAt);
    }
    if (body.lookAt.id) {
      camera.lookAtId = body.lookAt.id;
    }
  }

  return camera;
}

/**
 * Parses an already-fetched IIIF manifest into the viewer-ready shape.
 *
 * Unrecognised annotations are reported through `onDiagnostic` and skipped rather than aborting
 * the parse, so a manifest with one bad entry still renders the rest.
 */
export function parseManifest(manifest: IIIFManifest, options: ParseOptions = {}): ParsedManifest {
  const { language = 'en', onDiagnostic } = options;

  const models: ParsedModel[] = [];
  const cameras: ParsedCamera[] = [];

  const scenes = (manifest.items ?? []).filter((item) => item?.type === 'Scene');

  if (scenes.length === 0) {
    onDiagnostic?.({
      level: 'warning',
      message: 'Manifest contains no Scene; there is nothing to render.'
    });
  }

  if (scenes.length > 1) {
    onDiagnostic?.({
      level: 'info',
      message: `Manifest contains ${scenes.length} scenes; all of them are merged into one view.`
    });
  }

  scenes.forEach((scene) => {
    (scene.items ?? []).forEach((page) => {
      if (page?.type !== 'AnnotationPage') {
        return;
      }

      (page.items ?? []).forEach((annotation) => {
        const body = first(annotation?.body);

        if (isModelBody(body)) {
          const model = parseModelAnnotation(annotation, body as IIIFAnnotationBody, onDiagnostic);
          if (model) {
            models.push(model);
          }
          return;
        }

        if (isCameraBody(body)) {
          cameras.push(parseCameraAnnotation(annotation, body as IIIFAnnotationBody));
          return;
        }

        onDiagnostic?.({
          level: 'info',
          message: `Skipping annotation ${annotation?.id ?? '(no id)'} of unsupported body type "${
            body?.type ?? 'undefined'
          }".`
        });
      });
    });
  });

  return {
    manifest,
    metadata: parseMetadata(manifest, language),
    models,
    cameras,
    languages: Array.from(collectLanguages(manifest)).sort()
  };
}

export type LoadManifestOptions = ParseOptions & {
  signal?: AbortSignal;
  /** Injectable for testing and for consumers with their own HTTP stack. */
  fetchImpl?: typeof fetch;
};

/** Fetches a manifest by URL and parses it. Rejects on network, JSON, or HTTP-status failures. */
export async function loadManifest(url: string, options: LoadManifestOptions = {}): Promise<ParsedManifest> {
  const { signal, fetchImpl = fetch, ...parseOptions } = options;

  const response = await fetchImpl(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load IIIF manifest (${response.status} ${response.statusText}): ${url}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`IIIF manifest at ${url} is not valid JSON: ${detail}`);
  }

  if (!json || typeof json !== 'object') {
    throw new Error(`IIIF manifest at ${url} is not a JSON object.`);
  }

  return parseManifest(json as IIIFManifest, parseOptions);
}
