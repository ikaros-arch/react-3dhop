---
"@ikaros-arch/react-3dhop": minor
---

Extension foundations: the primitives the built-in controls use are now public, so tools and
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
