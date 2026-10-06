---
"@ikaros-arch/react-3dhop": minor
"@ikaros-arch/react-3dhop-iiif": patch
---

Fixed two related bugs that broke any custom `<Toolbar>` passed through `<IIIFViewer>` or `<IIIFMultiManifestViewer>` (and, more narrowly, any `<ThreeDHopViewer>` consumer rendering a toolbar-icon control outside a `<Toolbar>` wrapper):

- `ToolbarAssetsProvider` only wrapped the children `ThreeDHopViewer` classified as "the toolbar," so any other child needing `useToolbarAssets()` (including a `<Toolbar>` hidden behind a wrapper component) resolved its icons against the page root instead of `assetBaseUrl`. It now wraps every child.
- `ThreeDHopViewer` could only recognise a `<Toolbar>` as a *direct* child by element type, so `IIIFViewer`/`IIIFMultiManifestViewer` interposing `<IIIFProvider>`/`<IIIFMultiManifestProvider>` between it and the caller's children (needed for `useThreeDHopViewer()`) meant their built-in default toolbar always rendered underneath, and any toolbar the caller passed in was silently demoted to ordinary content. `ThreeDHopViewer` now accepts an explicit `toolbar` prop, and a new `extractToolbar()` export lets any wrapper hand its toolbar over directly instead of relying on structural detection. `IIIFViewer` and `IIIFMultiManifestViewer` both use it now.
