# react-3dhop-iiif

Renders [IIIF Presentation 4.0 / IIIF 3D](https://github.com/IIIF/3d/blob/main/temp-draft-4.md)
manifests with [3DHOP](https://3dhop.net/), on top of
[`react-3dhop`](../react-3dhop/README.md).

The IIIF 3D specification is still a draft. Keeping it in its own package means the core viewer
does not have to move every time the draft does.

```bash
npm install react-3dhop-iiif react-3dhop
```

`react`, `react-dom` and `react-3dhop` are peer dependencies. The package itself has **no runtime
dependencies**.

This README is the reference for manifest authoring and specification coverage.
[docs/iiif.md](../../docs/iiif.md) explains how the package is put together and where to extend it.

---

## Quick start

```tsx
import { IIIFViewer, IIIFMetadataPanel, IIIFSavedViewsPanel } from 'react-3dhop-iiif';

export function Viewer() {
  return (
    <IIIFViewer
      manifest="https://example.org/iiif/object/manifest.json"
      assetBaseUrl="/3dhop"
      width={800}
      height={600}
    >
      <IIIFMetadataPanel />
      <IIIFSavedViewsPanel />
    </IIIFViewer>
  );
}
```

`<IIIFViewer>` accepts everything `<ThreeDHopViewer>` does, except `models` and `modelUrl`, which
it derives from the manifest. `manifest` takes either a URL to fetch or an already-parsed manifest
object.

Panels must be rendered **inside** `<IIIFViewer>` to reach its context. The viewer renders its
children into a fixed-size, clipped box intended for canvas overlays, so to place panels elsewhere
on the page, portal them out — React context passes through portals. See
[`examples/react-3dhop-demo/src/IIIFDemo.tsx`](../../examples/react-3dhop-demo/src/IIIFDemo.tsx).

### Reading the manifest yourself

```tsx
const { metadata, models, cameras, language, setLanguage, goToCamera, saveCurrentView } =
  useIIIFManifest();
```

Every parsing and geometry function is also exported standalone, with no React and no dependency on
3DHOP's globals — usable in Node, and unit-tested there:

```ts
import { loadManifest, sceneFromManifest, buildModelMatrix, view2track } from 'react-3dhop-iiif';

const parsed = await loadManifest(url);
const scene = sceneFromManifest(parsed, { displayUnit: 'cm' });
```

---

## Manifest authoring

### Model formats

3DHOP streams [Nexus](https://vcg.isti.cnr.it/nexus/) (`.nxz`/`.nxs`) and loads `.ply`. When one
annotation offers several sources, the best supported one wins:

| Rank | `format` | Support |
|---|---|---|
| 1 | `nexus`, `nxz`, `nxs`, `application/octet-stream+nexus` | Streamed progressively — the format to publish |
| 2 | `ply`, `application/ply` | Loaded whole |
| 3 | `obj`, `model/obj` | **Cannot be rendered** — ranked here only so it is preferred over glTF |
| 4 | `glb`, `gltf`, `model/gltf-binary`, `model/gltf+json` | **Cannot be rendered** |

Comparison is case-insensitive, so `"format": "Nexus"` works. An unrecognised format ranks below
every known one rather than being discarded.

3DHOP has loaders for Nexus and PLY only. A model in any other format is still parsed, so the
manifest continues to describe the object, and a diagnostic says why nothing appeared. Adding an
OBJ or glTF loader is out of scope; convert to Nexus with
[`nxsbuild`](https://vcg.isti.cnr.it/nexus/) instead.

### Units

Two non-standard metadata fields control scale, recognised by their English or Norwegian labels:

| Label | Meaning | Default |
|---|---|---|
| `Measure Unit` / `Måleenhet` | The unit the manifest's own coordinates are authored in | `mm` |
| `Display Unit` / `Visningsenhet` | The unit the scene is rendered and measured in | the measure unit |

```json
{ "label": { "en": ["Measure Unit"] }, "value": { "en": ["m"] } }
```

A single model whose mesh is authored in a different unit from the rest of the manifest can say so
on its source, without disturbing anything else:

```json
{ "id": "…/alvim.nxz", "type": "Model", "format": "Nexus", "measureUnit": "mm" }
```

Recognised units are `km`, `m`, `cm`, `mm`, `um` (or `µm`) and `nm`. An unrecognised unit is
treated as a factor of 1, so a typo renders the object unscaled rather than failing.

The `Display Unit` also sets the label on measurements taken with the measuring tool, and picks the
clipping-border width, which otherwise looks invisible on a millimetre-scale object and enormous on
a metre-scale one.

### Placement and transforms

A model's position comes from the `PointSelector` on the annotation's target:

```json
"target": {
  "type": "SpecificResource",
  "source": [{ "id": "…/scene/1", "type": "Scene" }],
  "selector": [{ "type": "PointSelector", "x": 2.0, "y": 0.0, "z": 0.0 }]
}
```

`transform` is an **ordered list**, applied first entry first, and this package composes it in
order rather than flattening it. Order is significant: scaling then translating moves the model by
the unscaled offset, while translating then scaling moves it by the scaled one. The same holds for
rotation.

```json
"transform": [
  { "type": "ScaleTransform", "x": 1.5, "y": 1.5, "z": 1.5 },
  { "type": "RotateTransform", "x": -90.0, "y": -90.0, "z": 0.0 },
  { "type": "TranslateTransform", "x": 0.0, "y": 0.5, "z": 0.0 }
]
```

`RotateTransform` accepts either per-axis Euler angles in degrees (`x`/`y`/`z`, composed Z then Y
then X, matching 3DHOP's own rotation triple) or a single axis-angle (`{ "axis": "y", "angle": 45 }`).

The complete model matrix is:

```text
M = S(displayUnit ← measureUnit) · T(pointSelector) · L(transform list) · S(geometry unit override)
```

Read right to left: bring the mesh's vertices into the manifest's unit, apply the transform list,
place the result at the point selector, then convert the whole scene into the display unit. Keeping
the unit conversions outermost and innermost is what makes positions and translations scale
alongside the geometry.

Models sharing a source URL are collapsed onto one mesh, so placing the same object several times
downloads it once.

### Cameras

Camera annotations become buttons in `<IIIFSavedViewsPanel>`, and the first one is applied as the
opening view unless `applyInitialCamera={false}`:

```json
{
  "type": "Annotation",
  "body": {
    "type": "PerspectiveCamera",
    "label": { "en": ["Front"] },
    "fieldOfView": 50.0,
    "lookAt": { "type": "PointSelector", "x": 0, "y": 0.5, "z": 0 }
  },
  "target": {
    "type": "SpecificResource",
    "source": [{ "id": "…/scene/1", "type": "Scene" }],
    "selector": [{ "type": "PointSelector", "x": 0.0, "y": 3.0, "z": -8.0 }]
  }
}
```

The target's `PointSelector` is the camera position; `lookAt` is what it points at. `lookAt` may
instead reference another annotation by `id`, in which case the camera aims at that model's
position. Both `fieldOfView` and the shorthand `fov` are read. With no `lookAt`, the camera aims at
the scene centre.

`saveCurrentView()` returns an annotation in exactly this shape, ready to paste back into a
manifest.

### Language

Any IIIF language map is resolved against the active language, falling back through `en`, `no`,
`nb`, `nn` and then any remaining language, so a partially translated manifest still renders. The
language defaults to the browser's and can be overridden with the `language` prop or switched at
runtime through `<IIIFLanguageSwitcher>`, which hides itself when there is only one language to
choose from.

Metadata fields are recognised by their **English** label even when another language is displayed,
so switching language does not lose the unit or inventory fields.

---

## Panels

All five read from `useIIIFManifest()`, use semantic markup with no CSS framework, and accept
`className` props on every element. There is no bundled stylesheet; the demo's
[`IIIFDemo.css`](../../examples/react-3dhop-demo/src/IIIFDemo.css) is a starting point.

| Component | Shows |
|---|---|
| `<IIIFSummary>` | `summary` and the `requiredStatement` attribution |
| `<IIIFMetadataPanel>` | Recognised fields first, then the rest in manifest order |
| `<IIIFModelsPanel>` | Per-model visibility and transparency toggles |
| `<IIIFSavedViewsPanel>` | The manifest's cameras, plus "save current view" |
| `<IIIFLanguageSwitcher>` | Language selector; hidden when the manifest has one language |

---

## Error handling

A manifest that cannot be fetched or parsed puts the viewer into an error state and renders
`errorFallback` — it does not throw or leave a blank canvas.

Problems affecting only part of a manifest are reported as **diagnostics** and the rest still
renders: an annotation with no usable source, a glTF-only model, an unrecognised body type, a
manifest with no `Scene`, or one with several. Diagnostics reach you through the `onDiagnostic`
prop or the `diagnostics` array on the context.

---

## Supported IIIF 3D subset

Against the [draft specification](https://github.com/IIIF/3d/blob/main/temp-draft-4.md). ✅ full,
⚠️ partial, ❌ not implemented.

| Feature | Parsed | Rendered | Notes |
|---|---|---|---|
| **Containers** |
| `Scene` | ✅ | ✅ | |
| Multiple scenes | ✅ | ⚠️ | Merged into one view, with a diagnostic |
| Canvas in Scene | ❌ | ❌ | |
| Nested scenes | ❌ | ❌ | |
| **Resources** |
| `Model` as body | ✅ | ✅ | |
| `Model` via `SpecificResource` | ✅ | ✅ | Required for transforms |
| Several sources per annotation | ✅ | ✅ | Best supported format wins |
| `PerspectiveCamera` | ✅ | ✅ | Position, `lookAt`, `fieldOfView` |
| `OrthographicCamera` | ✅ | ✅ | Position, `lookAt` |
| **Lights** (`Ambient`/`Directional`/`Point`/`Spot`) | ❌ | ❌ | 3DHOP has one directional light, controlled by the viewer |
| **Transforms** |
| `ScaleTransform` | ✅ | ✅ | |
| `TranslateTransform` | ✅ | ✅ | |
| `RotateTransform` | ✅ | ✅ | Euler and axis-angle forms |
| Ordered composition | ✅ | ✅ | Composed as a matrix, not flattened |
| **Selectors** |
| `PointSelector` | ✅ | ✅ | Positions models and cameras |
| `PolygonZSelector` | ❌ | ❌ | For Canvas placement |
| **Properties** |
| `label`, `summary`, `metadata` | ✅ | ✅ | Multilingual |
| `requiredStatement` | ✅ | ✅ | Shown as attribution |
| `fieldOfView` / `fov` | ✅ | ✅ | |
| `lookAt` | ✅ | ✅ | Point or annotation reference |
| `backgroundColor` | ❌ | ❌ | Use the viewer's `backgroundUrl` |
| `duration` | ❌ | ❌ | Temporal scenes |
| `near` / `far` | ❌ | ❌ | Derived from scene extents instead |
| `exclude` | ❌ | ❌ | |
| **Formats** |
| Nexus (`.nxz`/`.nxs`) | ✅ | ✅ | Streamed progressively |
| PLY | ✅ | ✅ | |
| OBJ | ✅ | ❌ | Reported as a diagnostic; convert to Nexus |
| glTF / GLB | ✅ | ❌ | Reported as a diagnostic; convert to Nexus |

---

## Licence

GPL-3.0-or-later, matching 3DHOP.
