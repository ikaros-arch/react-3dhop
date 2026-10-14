# @ikaros-arch/react-3dhop-iiif

## 0.7.0

### Minor Changes

- [`d8b89d8`](https://github.com/ikaros-arch/react-3dhop/commit/d8b89d8a00e5ff2e4cf0a557590fc13c74e283d1) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - `useIIIFManifest()` gains `captureViewerState()`/`applyViewerState()`, the model visibility/transparency/solid-colour/lighting logic `saveCurrentView`/`goToCamera` already used internally, now exposed directly for apps with their own saved-view concept that isn't `saveCurrentView`'s IIIF annotation shape. `saveCurrentView`/`goToCamera` are refactored to use these themselves — no behaviour change for existing callers.

## 0.6.0

### Minor Changes

- [`b5e72bd`](https://github.com/ikaros-arch/react-3dhop/commit/b5e72bd456b642cd3ee08a680958fa74af916b2c) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Comments and saved views now compose into a fuller, more standardised document:

  - `ParsedComment.position`/`NewComment.position` are now optional. A comment with no `PointSelector` describes the whole scene (a general note) rather than a point in it (a spot) — its `position` is `undefined`, not `[0, 0, 0]`, so the two cases are never confused. `commentsToAnnotationPage` omits the selector entirely for such a comment; the parser reflects it back out the same way.
  - `saveCurrentView(label?, { sections })` and `goToCamera()` now carry renderer state IIIF has no vocabulary for — per-model visibility/transparency, scene-wide solid-colour and lighting (on/off plus direction), and `@ikaros-arch/react-3dhop`'s `SectionsState` — as a second, non-standard `ThreeDHopViewerState` body alongside the camera, the same extension pattern already used for the per-source `measureUnit`. Any IIIF 3D consumer that doesn't recognise it still renders the camera fine.
  - `useIIIFManifest()` gains `setModelTransparent(modelId, transparent)` alongside the existing `toggleModelTransparency`, since restoring a saved view needs to set a specific state rather than flip it; and `isSolidColorEnabled()`/`setSolidColor(enabled)` for the scene-wide texture/solid-colour toggle, which — unlike visibility and transparency — 3DHOP has no per-model version of. Lighting needed no new context method: 3DHOP already exposes a real `isSceneLightingEnabled()` getter, so `saveCurrentView` just reads it directly.
  - `<IIIFSavedViewsPanel>` gains `sections`/`onApplySections` props to wire a saved view's clipping-plane state to and from whichever component owns `<SectionsControl>`'s state.
  - Depends on `@ikaros-arch/react-3dhop`'s newly-exported `getHopAllTag()`.

## 0.5.0

### Minor Changes

- [`52696b5`](https://github.com/ikaros-arch/react-3dhop/commit/52696b546524ff84f7ae94a3a6c1a1265609309e) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Added support for user-authored comment annotations (IIIF/W3C Web Annotation `motivation: "commenting"`, `"describing"` or `"tagging"`, with a `TextualBody`), as a first-class feature alongside models and cameras:

  - `parseManifest`/`loadManifest` now also return `comments: ParsedComment[]`.
  - `useIIIFManifest()` exposes the live `comments` list plus `addComment`/`updateComment`/`removeComment` for session-local edits.
  - New standalone helpers `commentsToAnnotationPage`/`annotationPageToComments` round-trip comments as a standard IIIF `AnnotationPage`, for exporting or persisting them.
  - New optional `<IIIFAnnotationsPanel>` lists comments and provides a minimal add form.

## 0.4.0

### Minor Changes

- [`1aa74d3`](https://github.com/ikaros-arch/react-3dhop/commit/1aa74d3d4da13e15d67641de8c615275c59469d3) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - `useIIIFManifest()` now exposes `sceneRadius` (the scene's characteristic size in the model's own space units, `null` until `isSceneReady`), so consumers can scale something - e.g. an annotation spot's radius - proportionally to the object itself without needing to know whether its declared unit is millimetres or metres.

## 0.3.1

### Patch Changes

- [`2b76d9b`](https://github.com/ikaros-arch/react-3dhop/commit/2b76d9b0bc8015b17d7d497603f5e3e18e1ea75b) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Fixed two related bugs that broke any custom `<Toolbar>` passed through `<IIIFViewer>` or `<IIIFMultiManifestViewer>` (and, more narrowly, any `<ThreeDHopViewer>` consumer rendering a toolbar-icon control outside a `<Toolbar>` wrapper):

  - `ToolbarAssetsProvider` only wrapped the children `ThreeDHopViewer` classified as "the toolbar," so any other child needing `useToolbarAssets()` (including a `<Toolbar>` hidden behind a wrapper component) resolved its icons against the page root instead of `assetBaseUrl`. It now wraps every child.
  - `ThreeDHopViewer` could only recognise a `<Toolbar>` as a _direct_ child by element type, so `IIIFViewer`/`IIIFMultiManifestViewer` interposing `<IIIFProvider>`/`<IIIFMultiManifestProvider>` between it and the caller's children (needed for `useThreeDHopViewer()`) meant their built-in default toolbar always rendered underneath, and any toolbar the caller passed in was silently demoted to ordinary content. `ThreeDHopViewer` now accepts an explicit `toolbar` prop, and a new `extractToolbar()` export lets any wrapper hand its toolbar over directly instead of relying on structural detection. `IIIFViewer` and `IIIFMultiManifestViewer` both use it now.

## 0.3.0

### Minor Changes

- [`762dcdf`](https://github.com/ikaros-arch/react-3dhop/commit/762dcdfe48cb29af24c2326b2c928f419af85574) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - `parseCollection` now resolves each collection item's own `metadata` into `fields`, mirroring the manifest-level metadata parsing. The IIIF Cookbook's "Simple Collection" recipe (https://iiif.io/api/cookbook/recipe/0032-collection/) names "minimal metadata" as a property a Manifest reference may carry for presentation, specifically so a browse/listing UI can filter and display without dereferencing every Manifest — this surfaces that data instead of silently dropping it.

## 0.2.0

### Minor Changes

- [`d226c18`](https://github.com/ikaros-arch/react-3dhop/commit/d226c18e923626b8953279f138048a8febed782b) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - First release under the `@ikaros-arch` scope.

  - The vendored 3DHOP runtime is now its own package, `@ikaros-arch/3dhop`, and a peer dependency of
    `@ikaros-arch/react-3dhop`. The default `assetBaseUrl` is `/node_modules/@ikaros-arch/3dhop`; the
    7 MB sample model is no longer shipped, so `modelUrl`/`models` should always be supplied.
  - Packages ship an `exports` map, `sideEffects: false`, and accept React 17, 18 and 19.
  - Every vendored file that differs from upstream 3DHOP 4.3 carries a modification notice, and
    `PROVENANCE.md` states the licence of each file (GPL-3.0 / MIT / BSD-3-Clause).
