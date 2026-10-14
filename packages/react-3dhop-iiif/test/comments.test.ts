import { describe, expect, it } from 'vitest';
import { annotationPageToComments, commentsToAnnotationPage, createCommentId } from '../src/iiif/comments.js';
import type { ParsedComment } from '../src/iiif/types.js';

describe('commentsToAnnotationPage', () => {
  it('serialises a comment as a commenting TextualBody annotation', () => {
    const comments: ParsedComment[] = [{ id: 'c1', rawLabel: { en: ['Note'] }, text: 'Chip on the rim', position: [1, 2, 3] }];
    const page = commentsToAnnotationPage(comments, { sceneId: 'https://example.org/scene/1' });

    expect(page.type).toBe('AnnotationPage');
    expect(page.items).toHaveLength(1);
    expect(page.items![0]).toMatchObject({
      id: 'c1',
      type: 'Annotation',
      motivation: ['commenting'],
      label: { en: ['Note'] },
      body: { type: 'TextualBody', format: 'text/plain', value: 'Chip on the rim' }
    });
  });

  it('targets the given scene with a PointSelector at the comment position', () => {
    const comments: ParsedComment[] = [{ id: 'c1', text: 'hi', position: [1, -2, 3.5] }];
    const page = commentsToAnnotationPage(comments, { sceneId: 'https://example.org/scene/1' });
    const target = page.items![0].target as { source: Array<{ id: string }>; selector: Array<Record<string, number>> };

    expect(target.source[0].id).toBe('https://example.org/scene/1');
    expect(target.selector[0]).toMatchObject({ type: 'PointSelector', x: 1, y: -2, z: 3.5 });
  });

  it('returns an empty AnnotationPage for no comments', () => {
    expect(commentsToAnnotationPage([]).items).toEqual([]);
  });

  it('omits the selector entirely for a comment with no position', () => {
    const comments: ParsedComment[] = [{ id: 'note1', text: 'General note about this object' }];
    const page = commentsToAnnotationPage(comments, { sceneId: 'https://example.org/scene/1' });
    const target = page.items![0].target as { source: Array<{ id: string }>; selector?: unknown };

    expect(target.source[0].id).toBe('https://example.org/scene/1');
    expect(target).not.toHaveProperty('selector');
  });
});

describe('annotationPageToComments', () => {
  it('round-trips what commentsToAnnotationPage produces', () => {
    const original: ParsedComment[] = [
      { id: 'c1', rawLabel: { en: ['Note'] }, text: 'Chip on the rim', position: [1, 2, 3] },
      { id: 'c2', text: 'Another note', position: [-1, 0, 0.5] }
    ];
    const page = commentsToAnnotationPage(original, { sceneId: 'https://example.org/scene/1' });
    const roundTripped = annotationPageToComments(page);

    expect(roundTripped).toEqual(original);
  });

  it('parses a hand-authored commenting annotation page', () => {
    const comments = annotationPageToComments({
      type: 'AnnotationPage',
      items: [
        {
          id: 'a',
          type: 'Annotation',
          motivation: 'commenting',
          body: { value: 'hand authored' } as never,
          target: { type: 'SpecificResource', selector: [{ type: 'PointSelector', x: 0, y: 0, z: 0 }] }
        }
      ]
    });
    expect(comments).toEqual([{ id: 'a', rawLabel: undefined, text: 'hand authored', position: [0, 0, 0] }]);
  });

  it('round-trips a note with no position as position: undefined, not the origin', () => {
    const original: ParsedComment[] = [{ id: 'note1', text: 'General note about this object' }];
    const page = commentsToAnnotationPage(original, { sceneId: 'https://example.org/scene/1' });
    const roundTripped = annotationPageToComments(page);

    expect(roundTripped).toEqual(original);
    expect(roundTripped[0].position).toBeUndefined();
  });
});

describe('createCommentId', () => {
  it('generates distinct ids on successive calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => createCommentId()));
    expect(ids.size).toBe(20);
  });
});
