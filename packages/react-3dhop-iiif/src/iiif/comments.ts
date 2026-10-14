import { parseManifest } from './parser.js';
import type { IIIFAnnotationPage, IIIFManifest, LocalizableValue, ParsedComment, Vector3 } from './types.js';

export type AnnotationPageOptions = {
  /** Base for the generated `@id`s. */
  idBase?: string;
  /** Id of the `Scene` the comments target. */
  sceneId?: string;
};

/** What a caller supplies to create a new comment; `id` is generated when omitted. */
export type NewComment = {
  id?: string;
  label?: LocalizableValue;
  text: string;
  /** Omit for a comment that describes the whole scene rather than a point in it. */
  position?: Vector3;
};

let counter = 0;

/** A reasonably unique id for a comment created in the browser, not yet backed by a manifest `@id`. */
export function createCommentId(): string {
  counter += 1;
  return `comment_${Date.now().toString(36)}_${counter}`;
}

/**
 * Serialises comments as a standalone IIIF `AnnotationPage`, ready to merge into a manifest's
 * `Scene` or to export on its own. The inverse of {@link annotationPageToComments}.
 */
export function commentsToAnnotationPage(
  comments: readonly ParsedComment[],
  { idBase = 'https://example.org/iiif/3d', sceneId = 'https://example.org/iiif/3d/scene/1' }: AnnotationPageOptions = {}
): IIIFAnnotationPage {
  return {
    id: `${idBase}/annotations/comments`,
    type: 'AnnotationPage',
    items: comments.map((comment) => ({
      id: comment.id,
      type: 'Annotation',
      motivation: ['commenting'],
      label: comment.rawLabel,
      body: { type: 'TextualBody', format: 'text/plain', value: comment.text },
      target: {
        type: 'SpecificResource',
        source: [{ id: sceneId, type: 'Scene' }],
        ...(comment.position
          ? { selector: [{ type: 'PointSelector', x: comment.position[0], y: comment.position[1], z: comment.position[2] }] }
          : {})
      }
    }))
  };
}

/**
 * Parses a standalone `AnnotationPage` of comments back out, e.g. one previously produced by
 * {@link commentsToAnnotationPage}. Reuses {@link parseManifest} by wrapping the page in a minimal
 * Manifest/Scene, rather than duplicating its annotation-parsing rules.
 */
export function annotationPageToComments(page: IIIFAnnotationPage): ParsedComment[] {
  const manifest: IIIFManifest = {
    type: 'Manifest',
    items: [{ type: 'Scene', items: [page] }]
  };
  return parseManifest(manifest).comments;
}
