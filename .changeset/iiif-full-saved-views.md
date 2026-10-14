---
"@ikaros-arch/react-3dhop-iiif": minor
---

Comments and saved views now compose into a fuller, more standardised document:

- `ParsedComment.position`/`NewComment.position` are now optional. A comment with no `PointSelector` describes the whole scene (a general note) rather than a point in it (a spot) — its `position` is `undefined`, not `[0, 0, 0]`, so the two cases are never confused. `commentsToAnnotationPage` omits the selector entirely for such a comment; the parser reflects it back out the same way.
- `saveCurrentView(label?, { sections })` and `goToCamera()` now carry renderer state IIIF has no vocabulary for — per-model visibility/transparency, scene-wide solid-colour and lighting (on/off plus direction), and `@ikaros-arch/react-3dhop`'s `SectionsState` — as a second, non-standard `ThreeDHopViewerState` body alongside the camera, the same extension pattern already used for the per-source `measureUnit`. Any IIIF 3D consumer that doesn't recognise it still renders the camera fine.
- `useIIIFManifest()` gains `setModelTransparent(modelId, transparent)` alongside the existing `toggleModelTransparency`, since restoring a saved view needs to set a specific state rather than flip it; and `isSolidColorEnabled()`/`setSolidColor(enabled)` for the scene-wide texture/solid-colour toggle, which — unlike visibility and transparency — 3DHOP has no per-model version of. Lighting needed no new context method: 3DHOP already exposes a real `isSceneLightingEnabled()` getter, so `saveCurrentView` just reads it directly.
- `<IIIFSavedViewsPanel>` gains `sections`/`onApplySections` props to wire a saved view's clipping-plane state to and from whichever component owns `<SectionsControl>`'s state.
- Depends on `@ikaros-arch/react-3dhop`'s newly-exported `getHopAllTag()`.
