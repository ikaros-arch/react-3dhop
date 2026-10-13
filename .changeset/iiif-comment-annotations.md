---
"@ikaros-arch/react-3dhop-iiif": minor
---

Added support for user-authored comment annotations (IIIF/W3C Web Annotation `motivation: "commenting"`, `"describing"` or `"tagging"`, with a `TextualBody`), as a first-class feature alongside models and cameras:

- `parseManifest`/`loadManifest` now also return `comments: ParsedComment[]`.
- `useIIIFManifest()` exposes the live `comments` list plus `addComment`/`updateComment`/`removeComment` for session-local edits.
- New standalone helpers `commentsToAnnotationPage`/`annotationPageToComments` round-trip comments as a standard IIIF `AnnotationPage`, for exporting or persisting them.
- New optional `<IIIFAnnotationsPanel>` lists comments and provides a minimal add form.
