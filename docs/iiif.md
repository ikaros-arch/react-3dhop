# IIIF 3D

`react-3dhop-iiif` renders [IIIF Presentation 4.0 / IIIF 3D](https://github.com/IIIF/3d/blob/main/temp-draft-4.md)
manifests with 3DHOP. This page explains how it fits together; the
[package README](../packages/react-3dhop-iiif/README.md) is the reference for authoring manifests,
unit handling, and the exact subset of the specification that is supported.

```bash
npm install @ikaros-arch/react-3dhop-iiif @ikaros-arch/react-3dhop @ikaros-arch/3dhop
```

```tsx
import { IIIFViewer, IIIFSummary, IIIFMetadataPanel, IIIFSavedViewsPanel } from '@ikaros-arch/react-3dhop-iiif';

<IIIFViewer manifest="https://example.org/iiif/object/manifest.json" assetBaseUrl="/3dhop">
  <IIIFSummary />
  <IIIFMetadataPanel />
  <IIIFSavedViewsPanel />
</IIIFViewer>
```

## Why a separate package

The IIIF 3D specification is a draft and still moving. Keeping it out of `react-3dhop` means the
core viewer does not have to move with it, and consumers who have no interest in IIIF do not carry
the code. The dependency runs one way only: `react-3dhop-iiif` has `react-3dhop` as a peer
dependency and **no runtime dependencies at all**.

Everything the IIIF package needs from the core is a public prop or a context hook. There is no
private channel between them — which is the test for whether a feature belongs in the core or here.

## How a manifest becomes a scene

```
manifest ──parser.ts──▶ ParsedManifest ──toModels.ts──▶ { models, space, config }
                                                              │
                                                    <ThreeDHopViewer …>
```

**`parser.ts`** walks `Scene` → `AnnotationPage` → `Annotation`, handling both `Model` bodies and
`SpecificResource` wrappers, array-valued `body`/`target`/`selector`, and several sources per
annotation. It resolves nothing about rendering; it produces a plain description of what the
manifest says.

**`toModels.ts`** turns that description into viewer props: a `models` map, plus the `space` and
`config` blocks documented in [scene-configuration.md](scene-configuration.md). This is where units
are resolved and each model's matrix is composed:

```text
M = S(displayUnit ← measureUnit) · T(pointSelector) · L(transform list) · S(geometry unit override)
```

The transform list is composed **in order**, as the specification requires, and emitted through the
core's `ModelTransformConfig.matrix`. Order matters — scaling then translating moves a model by the
unscaled offset, translating then scaling by the scaled one — so a flattened representation cannot
express what a manifest means. Models sharing a source URL collapse onto one mesh, so placing the
same object several times downloads it once.

**`IIIFViewer.tsx`** fetches, parses, derives the scene, renders `<ThreeDHopViewer>`, and publishes
the result through `IIIFProvider`. It applies the manifest's first camera as the opening view from a
scene observer — the earliest point at which scene framing exists.

## Several manifests in one scene

`IIIFMultiManifestViewer.tsx` is a parallel path, not a generalisation of `IIIFViewer.tsx`, built
because `IIIFContext`'s visibility/transparency state is public API keyed by bare IIIF annotation id
— making it manifest-aware would be a breaking change for every existing consumer of
`useIIIFManifest()`/`IIIFModelsPanel`. Instead:

```
manifest[] ──parser.ts (×N)──▶ ParsedManifest[] ──toMultiModels.ts──▶ { models, space, config }
                                                                            │
                                                                  <ThreeDHopViewer …>
```

**`toMultiModels.ts`** calls `sceneFromManifest()` once per manifest to reuse all of its unit
conversion and matrix building, then re-keys every model and mesh id with a per-manifest prefix so
two manifests can never collide, and left-multiplies each model's matrix by a translation that
spreads manifests out spatially (`layoutManifests()`). There is no real bounding-box data available
at this point — geometry streams in only once 3DHOP has the mesh — so the layout radius is a
heuristic derived from how far apart a manifest's own annotations are placed, not a true bounding
sphere; see the package README's "Multiple manifests in one viewer" section for the practical
implications of that.

**`multiManifestContext.tsx`** is deliberately a smaller context than `IIIFContext`: no cameras, no
saved views, no language, no metadata — just per-model visibility/transparency, keyed by
`(manifestKey, modelId)` instead of a bare model id, since the id namespace is no longer unique to a
single manifest.

## Everything pure is exported

The parsing and geometry layer takes no React, touches no DOM, and never reads 3DHOP's globals.
Camera conversion takes scene framing as an argument rather than reading it off a live presenter:

```ts
import { loadManifest, sceneFromManifest, buildModelMatrix, view2track } from '@ikaros-arch/react-3dhop-iiif';

const parsed = await loadManifest(url);
const scene = sceneFromManifest(parsed, { displayUnit: 'cm' });
```

That is what makes the package testable in Node, and it is why the suite covers the parser,
units, transforms and camera maths without a browser. Keep new logic on that side of the line where
you can.

## Reading the state

```tsx
const {
  status, error, diagnostics,
  metadata, models, cameras,
  language, languages, setLanguage, localize,
  measureUnit, displayUnit,
  isSceneReady, goToCamera, saveCurrentView,
  setModelVisible, isModelVisible, toggleModelTransparency, isModelTransparent
} = useIIIFManifest();
```

`useIIIFManifest()` must be called from inside an `<IIIFViewer>`. The five bundled panels
(`IIIFSummary`, `IIIFMetadataPanel`, `IIIFModelsPanel`, `IIIFSavedViewsPanel`,
`IIIFLanguageSwitcher`) are built on nothing else, so a replacement of your own has the same
access they do.

Panels must be rendered inside `<IIIFViewer>` to reach the context, but the viewer renders children
into a fixed-size clipped box meant for canvas overlays. To place a panel elsewhere on the page,
portal it out — React context passes through portals. The demo's
[`IIIFDemo.tsx`](../examples/react-3dhop-demo/src/IIIFDemo.tsx) does this.

## Failure is partial by default

A manifest that cannot be fetched or parsed puts the viewer into an error state and renders
`errorFallback`; it does not throw or leave a blank canvas.

Anything that breaks only part of a manifest is reported as a **diagnostic** and the rest still
renders — an annotation with no usable source, a model in a format 3DHOP cannot load, an
unrecognised body type, a manifest with no `Scene` or with several. Diagnostics arrive through the
`onDiagnostic` prop and accumulate in `diagnostics` on the context.

The demo's `broken.json` exercises this path deliberately.

## Formats

3DHOP has loaders for Nexus (`.nxz`/`.nxs`) and PLY, and nothing else. OBJ and glTF sources are
still parsed — so the manifest keeps describing the object — but produce a diagnostic explaining
why nothing appeared. Convert to Nexus with [`nxsbuild`](https://vcg.isti.cnr.it/nexus/).
