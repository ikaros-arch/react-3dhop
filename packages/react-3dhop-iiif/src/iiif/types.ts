/**
 * Types for the subset of IIIF Presentation API 4.0 / IIIF 3D that this package understands.
 *
 * The raw `IIIF*` types describe manifest JSON as authored. The `Parsed*` types describe the
 * normalised, viewer-ready shape the parser produces.
 */

/** An IIIF language map: BCP-47 tag → one or more strings. May also appear as a bare string. */
export type LanguageMap = Record<string, string | string[]>;

export type LocalizableValue = LanguageMap | string;

export type Vector3 = [number, number, number];

export type IIIFMetadataEntry = {
  label?: LocalizableValue;
  value?: LocalizableValue;
};

export type IIIFPointSelector = {
  type?: 'PointSelector' | string;
  x?: number;
  y?: number;
  z?: number;
};

export type IIIFTransform = {
  type?: 'ScaleTransform' | 'TranslateTransform' | 'RotateTransform' | string;
  x?: number;
  y?: number;
  z?: number;
  /** Single axis-angle form: `{ type: 'RotateTransform', axis: 'y', angle: 45 }`. */
  axis?: 'x' | 'y' | 'z' | string;
  angle?: number;
};

export type IIIFModelSource = {
  id?: string;
  type?: 'Model' | string;
  format?: string;
  /** Non-standard extension: the unit the model's own coordinates are expressed in. */
  measureUnit?: string;
};

export type IIIFAnnotationBody = {
  id?: string;
  type?: string;
  label?: LocalizableValue;
  format?: string;
  measureUnit?: string;
  source?: IIIFModelSource | IIIFModelSource[];
  transform?: IIIFTransform[];
  /** Camera-only fields. */
  fieldOfView?: number;
  fov?: number;
  lookAt?: IIIFPointSelector & { id?: string };
};

export type IIIFAnnotationTarget = {
  type?: string;
  source?: unknown;
  selector?: IIIFPointSelector | IIIFPointSelector[];
};

export type IIIFAnnotation = {
  id?: string;
  type?: string;
  motivation?: string | string[];
  label?: LocalizableValue;
  body?: IIIFAnnotationBody | IIIFAnnotationBody[];
  target?: IIIFAnnotationTarget | IIIFAnnotationTarget[] | string;
};

export type IIIFAnnotationPage = {
  id?: string;
  type?: string;
  items?: IIIFAnnotation[];
};

export type IIIFScene = {
  id?: string;
  type?: string;
  label?: LocalizableValue;
  items?: IIIFAnnotationPage[];
};

export type IIIFManifest = {
  id?: string;
  type?: string;
  label?: LocalizableValue;
  summary?: LocalizableValue;
  requiredStatement?: {
    label?: LocalizableValue;
    value?: LocalizableValue;
  };
  metadata?: IIIFMetadataEntry[];
  items?: IIIFScene[];
};

// ---------------------------------------------------------------------------
// Parsed (viewer-ready) shapes
// ---------------------------------------------------------------------------

export type ParsedModel = {
  /** The annotation id, used as the stable key for this instance. */
  id: string;
  /** Raw language map for the annotation label; resolve with the active language. */
  rawLabel?: LocalizableValue;
  url: string;
  format?: string;
  /** Unit for this model specifically; falls back to the manifest's `MEASURE_UNIT`. */
  measureUnit?: string;
  /** World-space placement from the target `PointSelector`. */
  position: Vector3;
  /** The manifest's `transform` list, in authored order. */
  transforms: IIIFTransform[];
};

export type ParsedCamera = {
  id?: string;
  type: 'PerspectiveCamera' | 'OrthographicCamera';
  rawLabel?: LocalizableValue;
  position: Vector3;
  /** Field of view in degrees, when the manifest specifies one. */
  fov?: number;
  /** Explicit look-at point, when `lookAt` carries coordinates. */
  target?: Vector3;
  /** Annotation id the camera looks at, when `lookAt` is a reference. */
  lookAtId?: string;
};

/**
 * Manifest-level metadata. The five `knownFields` are recognised by label (in English or
 * Norwegian) and lifted out; everything else is kept verbatim in `fields`, in manifest order.
 */
export type ParsedMetadata = {
  label: string;
  summary?: string;
  attribution?: string;
  museum?: string;
  inventory?: string;
  objectId?: string;
  /** Unit the manifest's coordinates are authored in. Defaults to `mm` downstream. */
  measureUnit?: string;
  /** Unit the viewer should present measurements in. Defaults to `measureUnit` downstream. */
  displayUnit?: string;
  /** Every metadata entry, including the recognised ones, resolved into the active language. */
  fields: Array<{ label: string; value: string }>;
};

export type ParsedManifest = {
  manifest: IIIFManifest;
  metadata: ParsedMetadata;
  models: ParsedModel[];
  cameras: ParsedCamera[];
  /** Every language tag appearing anywhere in the manifest's language maps. */
  languages: string[];
};

/** A world-space camera, the intermediate form between IIIF and the 3DHOP trackball. */
export type View = {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  /** Degrees; `0` denotes an orthographic camera. */
  fov: number;
};

/** Non-fatal notes emitted while parsing — unknown formats, skipped annotations, and so on. */
export type Diagnostic = {
  level: 'info' | 'warning';
  message: string;
};

export type DiagnosticHandler = (diagnostic: Diagnostic) => void;

// ---------------------------------------------------------------------------
// IIIF Collection (a listing of manifests, e.g. for a dropdown or carousel)
// ---------------------------------------------------------------------------

export type IIIFThumbnail = {
  id: string;
  type?: string;
  format?: string;
};

export type IIIFCollectionItem = {
  id: string;
  type?: 'Manifest' | string;
  label?: LocalizableValue;
  summary?: LocalizableValue;
  thumbnail?: IIIFThumbnail | IIIFThumbnail[];
};

export type IIIFCollection = {
  id?: string;
  type?: 'Collection' | string;
  label?: LocalizableValue;
  summary?: LocalizableValue;
  items?: IIIFCollectionItem[];
};

export type ParsedCollectionItem = {
  id: string;
  label: string;
  summary?: string;
  /** URL of the first thumbnail image, when the item has one. */
  thumbnail?: string;
};

export type ParsedCollection = {
  collection: IIIFCollection;
  label: string;
  summary?: string;
  items: ParsedCollectionItem[];
};
