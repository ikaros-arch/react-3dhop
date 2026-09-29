# Upgrading to react-3dhop 0.2.0

Nothing in the 0.1 API was removed or changed shape. A viewer that compiles against 0.1 compiles
against 0.2, and renders the same scene. The notes below cover what is new and the two places where
runtime behaviour differs.

## New

**Scene-level configuration.** `space`, `config`, `trackball` and `nexusTargetError` on
`<ThreeDHopViewer>` reach settings the wrapper used to fix — scene framing, camera projection,
clipping-border appearance, point size, screenshot naming, trackball choice, and Nexus streaming
detail. See [scene-configuration.md](scene-configuration.md).

**Trackball selection by name.** `trackball={{ type: 'SphereTrackball' }}` instead of reaching into
`window`. All five of 3DHOP's trackballs are now loaded, including `RailTrackball`, which was
previously missing from the script list.

**A wider `PresenterInstance`.** Scene framing (`sceneCenter`, `sceneRadiusInv`), explicit
projection setters, Nexus target error, and per-instance visibility and transparency by name. All
optional, all listed in [scene-configuration.md](scene-configuration.md#presenter-members).

**`react-3dhop-iiif`.** A separate package that renders IIIF 3D manifests on top of this one. See
[iiif.md](iiif.md).

## Behaviour changes

**jQuery is gone.** `js/jquery.js` is no longer vendored and no longer loaded. Nothing in the
viewer used it, but if you were relying on 3DHOP's asset bundle to put jQuery on the page for your
own code, load it yourself.

**The vendored 3DHOP build moved to the "4.3.5" patch set.** `presenter.js`, `nexus.js`,
`nexus.monitor.js` and all five trackballs were replaced as a set — the trackball constructor
signature changed, so they cannot be mixed with the old presenter. Visible differences: helper
geometry (picked points, measurements) has its own point size independent of the model point size,
screenshot filenames follow `config.screenshotBaseName`/`screenshotTime`, and the light trackball
tracks drag deltas relative to canvas size rather than a fixed divisor. Full detail in
[`PROVENANCE.md`](../packages/3dhop/PROVENANCE.md).

If a scene looked right in 0.1 and looks subtly different now, these are the places to check first.

## Configuration props and re-renders

`space`, `config` and `trackball` are compared structurally, not by identity, so writing them as
inline object literals does not rebuild the scene on every render:

```tsx
// Fine — a fresh object each render, but structurally unchanged.
<ThreeDHopViewer space={{ centerMode: 'scene' }} />
```

A custom trackball constructor passed as `trackball.type` is compared by identity, so define it
once outside the component rather than inline.

Note that `models` is **not** treated this way. Build it with `useMemo`, or hoist it to module
scope, as in 0.1.

## Repository layout

If you consume the package from npm, nothing changed: the name and entry points are the same, and
the 3DHOP assets still ship under `dist/3dhop`.

If you consume the repository directly — a git dependency, a path dependency, or a checkout — the
library moved from the repository root into `packages/react-3dhop/`. See
[workspace.md](workspace.md).
