# @ikaros-arch/3dhop

## 0.5.1

### Patch Changes

- [`97b9156`](https://github.com/ikaros-arch/react-3dhop/commit/97b915660605591b6fcd695f4e347892c688a15f) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Fix trackball `setup()` mutating the caller's `minMaxPhi`/`minMaxTheta` (or `minMaxAngleX`/`minMaxAngleY`) clamp arrays in place while converting them from degrees to radians. Harmless upstream (where `setup()` runs once per page load), but react-3dhop reconstructs the trackball on every `setScene()` with a reused `trackOptions` object, so a second conversion of the same array re-converted already-converted radians - shrinking the rotation clamp range by ~57x on every structural scene update (e.g. adding an annotation spot) until rotation was clamped to almost nothing. Affects `trackball_turntable.js`, `trackball_turntable_pan.js`, `trackball_rail.js`, and `trackball_pantilt.js`.

## 0.5.0

### Minor Changes

- [`f2a1966`](https://github.com/ikaros-arch/react-3dhop/commit/f2a196616a217a997f463e624d6ce93080667507) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Toolbar controls can now render arbitrary React content as their icon (e.g. an icon-font `<i>` element), not only an image URL.

  Every built-in control's `icon` prop (and `ToggleIcons.enabled`/`disabled`) now accepts `string | React.ReactNode`: a string is still resolved as an image URL against `assetBaseUrl` exactly as before, and anything else renders as-is inside the toolbar's icon slot. `ToggleImageConfig` (used by `ToggleImagePair` for custom controls) gains the same behavior via a new `icon` field, which replaces the old `src: string` field — update any direct `ToggleImageConfig` construction accordingly.

  New exported helper `resolveControlIcon(assetBaseUrl, override, fallback)` mirrors `resolveToggleIcon` but is ReactNode-aware, for building custom controls with the same fallback behavior as the built-ins.

  The vendored `@ikaros-arch/3dhop` runtime's `init.js` toolbar hover/mousedown/mouseup/touch wiring and opacity sync previously matched `#toolbar img`, hardcoding the assumption that every toolbar icon is an `<img>`. Both now match `#toolbar [data-hop-id]` instead (an attribute every toolbar icon already carries, image or not), so non-image icon content gets identical interaction behavior. No markup changes are needed for existing `<img>`-based toolbars.

## 0.4.0

### Minor Changes

- [`8721916`](https://github.com/ikaros-arch/react-3dhop/commit/8721916072ac8339cbdb756c6620eb3a5bdf995f) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - `InteractiveToolConfig` gained optional `captureState`/`restoreState`, and the viewer context gained `captureToolState()`/`restoreToolState()`, so an app can snapshot a tool's in-progress picked points (e.g. to persist alongside a saved camera view) and restore them later. Wired up for `AngleControl` and the built-in `pick` and `measure` tools — `measure` needed a small addition to the vendored 3DHOP presenter (`restoreMeasurement(pointA, pointB)`) since it previously had no way to redisplay a completed measurement without the user re-picking both points; see `packages/3dhop/PROVENANCE.md`.

## 0.3.0

### Minor Changes

- [#5](https://github.com/ikaros-arch/react-3dhop/pull/5) [`ecc3787`](https://github.com/ikaros-arch/react-3dhop/commit/ecc378750afb1da2ffd20259a26229a647f8eab0) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - Add skin assets for the new react-3dhop controls: `skins/dark/angle.png` / `angle_on.png` (angle-measurement toolbar icon, by Alexis Pantos, from BITFROST), `skins/dark/grid.svg` / `grid_on.svg` (grid overlay toolbar icon), and `skins/icons/mouse2-left.svg` / `mouse2-right.svg` (mouse-button hint glyphs). See `PROVENANCE.md`.

## 0.2.0

### Minor Changes

- [`d226c18`](https://github.com/ikaros-arch/react-3dhop/commit/d226c18e923626b8953279f138048a8febed782b) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - First release under the `@ikaros-arch` scope.

  - The vendored 3DHOP runtime is now its own package, `@ikaros-arch/3dhop`, and a peer dependency of
    `@ikaros-arch/react-3dhop`. The default `assetBaseUrl` is `/node_modules/@ikaros-arch/3dhop`; the
    7 MB sample model is no longer shipped, so `modelUrl`/`models` should always be supplied.
  - Packages ship an `exports` map, `sideEffects: false`, and accept React 17, 18 and 19.
  - Every vendored file that differs from upstream 3DHOP 4.3 carries a modification notice, and
    `PROVENANCE.md` states the licence of each file (GPL-3.0 / MIT / BSD-3-Clause).
