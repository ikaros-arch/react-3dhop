# @ikaros-arch/react-3dhop

## 0.8.0

### Minor Changes

- [`e783add`](https://github.com/ikaros-arch/react-3dhop/commit/e783add799634e2a152faf8848234ea697f45ec9) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Added `triggerToolbarAction(action)` to `useThreeDHopViewer()`.

  `LightingControl`, `ColorControl`, `SpecularControl`, `TransparencyControl`, `CameraControl` and `HomeControl` have no toggle state of their own — they only work because the vendored 3DHOP `init.js` wires a native click listener, once, to toolbar icons inside `#toolbar`. Rendering one of those controls' icons outside the toolbar (e.g. a custom sidebar panel) silently did nothing when clicked, since nothing ever called that listener for an element outside `#toolbar` or mounted after the page's one-time init scan.

  `triggerToolbarAction(action)` runs a toolbar action by id exactly as if its icon had been clicked in the real toolbar — first any handler registered via `registerToolbarAction`, then the built-ins (`home`, `zoomin`, `zoomout`, `lighting`, `color`, `specular`, `transparency`, `perspective`/`orthographic`, `hotspot`, `full`, `info`, `screenshot`) — so these controls can be driven correctly from anywhere in the tree. See "Driving toolbar actions from outside `#toolbar`" in docs/extending.md.

## 0.7.0

### Minor Changes

- [`f2a1966`](https://github.com/ikaros-arch/react-3dhop/commit/f2a196616a217a997f463e624d6ce93080667507) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Toolbar controls can now render arbitrary React content as their icon (e.g. an icon-font `<i>` element), not only an image URL.

  Every built-in control's `icon` prop (and `ToggleIcons.enabled`/`disabled`) now accepts `string | React.ReactNode`: a string is still resolved as an image URL against `assetBaseUrl` exactly as before, and anything else renders as-is inside the toolbar's icon slot. `ToggleImageConfig` (used by `ToggleImagePair` for custom controls) gains the same behavior via a new `icon` field, which replaces the old `src: string` field — update any direct `ToggleImageConfig` construction accordingly.

  New exported helper `resolveControlIcon(assetBaseUrl, override, fallback)` mirrors `resolveToggleIcon` but is ReactNode-aware, for building custom controls with the same fallback behavior as the built-ins.

  The vendored `@ikaros-arch/3dhop` runtime's `init.js` toolbar hover/mousedown/mouseup/touch wiring and opacity sync previously matched `#toolbar img`, hardcoding the assumption that every toolbar icon is an `<img>`. Both now match `#toolbar [data-hop-id]` instead (an attribute every toolbar icon already carries, image or not), so non-image icon content gets identical interaction behavior. No markup changes are needed for existing `<img>`-based toolbars.

## 0.6.0

### Minor Changes

- [`8721916`](https://github.com/ikaros-arch/react-3dhop/commit/8721916072ac8339cbdb756c6620eb3a5bdf995f) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - `InteractiveToolConfig` gained optional `captureState`/`restoreState`, and the viewer context gained `captureToolState()`/`restoreToolState()`, so an app can snapshot a tool's in-progress picked points (e.g. to persist alongside a saved camera view) and restore them later. Wired up for `AngleControl` and the built-in `pick` and `measure` tools — `measure` needed a small addition to the vendored 3DHOP presenter (`restoreMeasurement(pointA, pointB)`) since it previously had no way to redisplay a completed measurement without the user re-picking both points; see `packages/3dhop/PROVENANCE.md`.

## 0.5.0

### Minor Changes

- [`2b76d9b`](https://github.com/ikaros-arch/react-3dhop/commit/2b76d9b0bc8015b17d7d497603f5e3e18e1ea75b) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Fixed two related bugs that broke any custom `<Toolbar>` passed through `<IIIFViewer>` or `<IIIFMultiManifestViewer>` (and, more narrowly, any `<ThreeDHopViewer>` consumer rendering a toolbar-icon control outside a `<Toolbar>` wrapper):

  - `ToolbarAssetsProvider` only wrapped the children `ThreeDHopViewer` classified as "the toolbar," so any other child needing `useToolbarAssets()` (including a `<Toolbar>` hidden behind a wrapper component) resolved its icons against the page root instead of `assetBaseUrl`. It now wraps every child.
  - `ThreeDHopViewer` could only recognise a `<Toolbar>` as a _direct_ child by element type, so `IIIFViewer`/`IIIFMultiManifestViewer` interposing `<IIIFProvider>`/`<IIIFMultiManifestProvider>` between it and the caller's children (needed for `useThreeDHopViewer()`) meant their built-in default toolbar always rendered underneath, and any toolbar the caller passed in was silently demoted to ordinary content. `ThreeDHopViewer` now accepts an explicit `toolbar` prop, and a new `extractToolbar()` export lets any wrapper hand its toolbar over directly instead of relying on structural detection. `IIIFViewer` and `IIIFMultiManifestViewer` both use it now.

## 0.4.0

### Minor Changes

- [#5](https://github.com/ikaros-arch/react-3dhop/pull/5) [`bb56cc1`](https://github.com/ikaros-arch/react-3dhop/commit/bb56cc1d238d315f48174513bca11b02502807ee) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Add `AngleControl`, a toolbar toggle that measures the angle between three picked points (drawn as scene entities with a translucent wedge) and shows the result in a copyable sidecar. Ported from the BITFROST viewer. Also exports the `computeAngle` / `angleEntities` / `formatAngle` geometry helpers, the toolbar building blocks (`ToggleImagePair`, `CopyableOutput`, `useToolbarSidecar`, `useToolbarAssets`, `resolveToggleIcon`) and `useOptionalThreeDHopViewer`; the viewer context gains `realignToolbar()`, and toolbar sidecars may declare their anchor icons with `data-hop-anchor`. Requires `@ikaros-arch/3dhop` ≥ 0.3.0 for the new icons.

- [#3](https://github.com/ikaros-arch/react-3dhop/pull/3) [`d06e64d`](https://github.com/ikaros-arch/react-3dhop/commit/d06e64debc80f75bff56cb0143d5a456bc887eac) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Extension foundations: the primitives the built-in controls use are now public, so tools and
  overlays can be built outside the package.

  - **`useSceneEntity(name, factory, deps)`** keeps a 3DHOP helper entity (points/lines/triangles)
    alive across scene rebuilds — `setScene` wipes entities, the hook re-creates them — and removes
    it on unmount.
  - **`useSceneBounds()`** returns the loaded scene's axis-aligned bounds from real geometry (Nexus
    base vertices, PLY bounding boxes, all transforms applied), falling back to bounding spheres and
    upgrading once Nexus base levels stream in. **`useSceneReady()`** exposes the ready signal.
  - **Open interactive-tool registry.** `registerInteractiveTool({ id, enable, isEnabled, onPick })`
    on the viewer context adds a canvas tool that is mutually exclusive with `measure`/`pick`;
    `toggleInteractiveTool(id)` and `activeInteractiveTool` drive and observe it. Pick-point
    results are dispatched to the active tool's `onPick` with both raw and coordinate-corrected
    points. `InteractiveTool` is now `string`.
  - **`registerSceneReadyObserver`** and **`registerLightObserver`** join the existing scene and
    trackball observers; **`useLightDirection()`** wraps the latter with a setter.
  - **Theming.** Every colour in the compass, cube and toolbar sidecars is now a `--r3dhop-*` CSS
    custom property with the stock look as fallback; new `theme` prop (`'light' | 'dark' |
'system'`) on `ThreeDHopViewer` sets `data-r3dhop-theme` and, for dark, the variables inline.
    `themeVar`, `readThemeToken`, `THEME_TOKENS`, `THEME_DEFAULTS` are exported.
  - `PresenterInstance` gains typings for `createEntity`/`deleteEntity`/`clearEntities`,
    `rotateLight`/`_lightDirection`, `screenshotData`, `_calculateBounding`/`_sceneBbox*`,
    `_isSceneReady`, and runtime `_scene.meshes`/`entities`.

  No behaviour changes for existing consumers: default rendering is identical, and `MeasureControl`
  /`PickControl` work as before on top of the new registry.

- [#5](https://github.com/ikaros-arch/react-3dhop/pull/5) [`b0e797e`](https://github.com/ikaros-arch/react-3dhop/commit/b0e797ecde0ed4663b497ddc9a98200e0f940962) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Add `GridControl` (toolbar toggle with a floor / box / fixed / axes mode picker) and the headless `GridOverlay`, plus the `buildFlatGrid` / `buildBoxGrid` / `buildFixedGrid` / `buildAxes` / `gridStepForUnit` geometry helpers. Grids follow the loaded scene's bounds, size their cells from the viewer's `measurementUnits`, and survive scene rebuilds. Ported from the BITFROST viewer.

- [#5](https://github.com/ikaros-arch/react-3dhop/pull/5) [`61f4e4b`](https://github.com/ikaros-arch/react-3dhop/commit/61f4e4b4bb9b9478e124acb8c23d8fdb7472957d) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Add `LightDirectionWidget`, a draggable disc overlay that sets the scene light direction and mirrors changes made via the canvas light trackball or `Home` (port of the BITFROST light controller). Exports the `lightDirectionToDisc` / `discToLightDirection` mapping helpers.

- [#5](https://github.com/ikaros-arch/react-3dhop/pull/5) [`8383fdc`](https://github.com/ikaros-arch/react-3dhop/commit/8383fdc3fc56abe2091f4ff5834899b316e77887) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - `ScreenshotControl` gains `copyToClipboard`, `download`, `baseName`, `withTime`, `onScreenshot` and `onError` props; when any is set the control captures via 3DHOP's `saveScreenshot()` frame and copies / renames / hands over the PNG itself. The helpers `captureScreenshot`, `copyImageToClipboard`, `dataUrlToBlob`, `downloadDataUrl` and `screenshotFileName` are exported. Clipboard copying ported from the BITFROST viewer.

- [#5](https://github.com/ikaros-arch/react-3dhop/pull/5) [`daa9745`](https://github.com/ikaros-arch/react-3dhop/commit/daa97455e6cd730feba99a8a9569591f57a8a220) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Add `ViewPresetButtons` and the `useViewPresets` hook (`viewFrom('top' | { phi, theta, … })`) for snapping the camera to standard views; `VIEW_PRESETS` and `viewPresetState` are exported and now also back `CubeNavigation`'s face targets.

### Patch Changes

- [#5](https://github.com/ikaros-arch/react-3dhop/pull/5) [`1f3c2a1`](https://github.com/ikaros-arch/react-3dhop/commit/1f3c2a1bfe0041be246f362685d3a81a06b42658) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Fixes found while smoke-testing the new controls:

  - The active interactive tool (measure / pick / angle …) is re-enabled after every scene apply. 3DHOP's `setScene` silently resets its measurement flags, so a parent re-render that changed the `models` object identity used to leave the toolbar showing a tool as active while the presenter had switched it off.
  - `CubeNavigation`, `CompassNavigation` and the view presets now send `[phi, theta, distance]` to the plain `TurnTableTrackball` (the default) instead of the six-value pan-trackball form, which was being read as distance 0.

## 0.3.0

### Minor Changes

- [`ca6ddc5`](https://github.com/ikaros-arch/react-3dhop/commit/ca6ddc50694d9e9afc5ad40db88c650af64860ab) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - `<ThreeDHopViewer>` no longer falls back to a bundled sample model. With neither `modelUrl` nor
  `models` it renders an empty scene; a `models` entry without its own `url` inherits `modelUrl`, and
  is skipped with a console warning if there is none.

- [`d226c18`](https://github.com/ikaros-arch/react-3dhop/commit/d226c18e923626b8953279f138048a8febed782b) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - First release under the `@ikaros-arch` scope.

  - The vendored 3DHOP runtime is now its own package, `@ikaros-arch/3dhop`, and a peer dependency of
    `@ikaros-arch/react-3dhop`. The default `assetBaseUrl` is `/node_modules/@ikaros-arch/3dhop`; the
    7 MB sample model is no longer shipped, so `modelUrl`/`models` should always be supplied.
  - Packages ship an `exports` map, `sideEffects: false`, and accept React 17, 18 and 19.
  - Every vendored file that differs from upstream 3DHOP 4.3 carries a modification notice, and
    `PROVENANCE.md` states the licence of each file (GPL-3.0 / MIT / BSD-3-Clause).
