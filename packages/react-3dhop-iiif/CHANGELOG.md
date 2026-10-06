# @ikaros-arch/react-3dhop-iiif

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
