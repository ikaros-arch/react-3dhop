# Scene configuration

`react-3dhop` 0.2.0 added four props to `<ThreeDHopViewer>` that reach settings previously fixed by
the wrapper: `space`, `config`, `trackball` and `nexusTargetError`. All four are optional and
additive — a viewer that does not pass them behaves exactly as it did in 0.1.

```tsx
<ThreeDHopViewer
  modelUrl="/models/statue.nxz"
  space={{ centerMode: 'scene', radiusMode: 'scene', cameraFOV: 45 }}
  config={{ showClippingBorder: true, clippingBorderSize: 0.002 }}
  trackball={{ type: 'SphereTrackball', trackOptions: { startDistance: 2.0 } }}
  nexusTargetError={0.8}
/>
```

`space` and `config` are forwarded to the presenter **only when supplied**, and each field is
independent: anything you leave out keeps 3DHOP's own default rather than being overwritten with a
wrapper default. `trackball` is merged over the wrapper's defaults instead, listed below.

## `space` — framing and camera

Mirrors `_parseSpace` in `presenter.js`. It decides where the trackball's origin sits, how large the
scene is considered to be, and how it is projected.

| Field | Type | Meaning |
| --- | --- | --- |
| `centerMode` | `'first' \| 'scene' \| 'specific' \| 'explicit'` | Which geometry defines the rotation centre |
| `radiusMode` | `'first' \| 'scene' \| 'specific' \| 'explicit'` | Which geometry defines the scene radius |
| `whichInstanceCenter` | `string` | Instance name, when `centerMode` is `'specific'` |
| `whichInstanceRadius` | `string` | Instance name, when `radiusMode` is `'specific'` |
| `explicitCenter` | `[x, y, z]` | Centre, when `centerMode` is `'explicit'` |
| `explicitRadius` | `number` | Radius, when `radiusMode` is `'explicit'` |
| `transform` | `ModelTransformConfig` | Transform applied to the whole scene |
| `cameraFOV` | `number` | Vertical field of view in degrees |
| `cameraNearFar` | `[near, far]` | Clipping planes; omit to let the presenter derive them |
| `cameraType` | `'perspective' \| 'orthographic'` | Initial projection |
| `sceneLighting` | `boolean` | Whether scene lighting starts enabled |

`centerMode: 'scene'` with `radiusMode: 'scene'` frames everything in the scene, which is what you
want when several models sit at different positions — the default (`'first'`) frames the first
instance only and pushes the rest off-screen.

The centre and radius the presenter derives from these settings are also what makes camera
conversion possible: they surface as `presenter.sceneCenter` and `presenter.sceneRadiusInv`, and
`react-3dhop-iiif` uses both to translate between a world-space camera and a trackball state.

## `config` — rendering

Mirrors `_parseConfig` in `presenter.js`.

| Field | Type | Meaning |
| --- | --- | --- |
| `pickedpointColor` | `[r, g, b]` | Colour of picked-point markers |
| `measurementColor` | `[r, g, b]` | Colour of the measurement line |
| `showClippingPlanes` | `boolean` | Draw the section planes themselves |
| `showClippingBorder` | `boolean` | Draw a border where geometry is cut |
| `clippingBorderSize` | `number` | Border width, **as a fraction of the scene radius** |
| `clippingBorderColor` | `[r, g, b]` | Border colour |
| `pointSize` | `number` | Point size for point-cloud models |
| `pointSizeMinMax` | `[min, max]` | Clamp for the above |
| `autoSaveScreenshot` | `boolean` | Save screenshots without prompting |
| `screenshotBaseName` | `string` | Filename stem for saved screenshots |
| `screenshotTime` | `boolean` | Append a timestamp to that filename |

`clippingBorderSize` is scale-dependent in practice: a value tuned for a millimetre-scale object
looks invisible on a metre-scale one, and enormous the other way round. `react-3dhop-iiif` derives
it from the manifest's display unit for exactly that reason.

## `trackball`

```ts
type TrackballConfig = {
  type?: TrackballName | unknown;
  trackOptions?: Partial<TrackOptions>;
  locked?: boolean;
};
```

`type` takes the **name** of one of the trackballs 3DHOP installs on `window`, so callers never have
to reach into the global scope themselves:

`'TurnTableTrackball'` (default) · `'TurntablePanTrackball'` · `'PanTiltTrackball'` ·
`'SphereTrackball'` · `'RailTrackball'`

An unrecognised name logs a warning and falls back to `TurnTableTrackball` rather than failing.
Anything that is not a string is assumed to be a constructor and passed straight through, which is
how you supply a trackball of your own.

`trackOptions` is merged over these defaults:

```ts
{ startPhi: 35.0, startTheta: 15.0, startDistance: 2.5,
  minMaxPhi: [-180, 180], minMaxTheta: [-30.0, 70.0], minMaxDist: [0.5, 3.0] }
```

`locked: true` disables interaction, for a viewer driven entirely from code.

## `nexusTargetError`

The screen-space error Nexus streams towards, applied after the scene is set. Lower values fetch
more detail and more bandwidth; the presenter's own default is `1.0`.

```tsx
<ThreeDHopViewer modelUrl="/models/large.nxz" nexusTargetError={0.5} />
```

## Presenter members

`PresenterInstance` — reachable through `useThreeDHopViewer().presenter` — gained the members this
work needed. All are optional, because the vendored presenter is the only implementation and older
builds may not have them:

- `sceneCenter`, `sceneRadiusInv` — scene framing, populated once the scene is set.
- `getCameraType()`, `setCameraPerspective()`, `setCameraOrthographic()` — projection, replacing
  the toggle-only API.
- `setNexusTargetError()`, `getNexusTargetError()`.
- `toggleInstanceVisibilityByName()`, `toggleInstanceTransparencyByName()` — per-instance control
  by name, which is what per-model panels need.
- `_scene.space` and `_scene.config` — the resolved settings, for reading back what the presenter
  actually applied.

Scene framing is only available after the scene is set, so read it from a scene observer rather
than an effect on `presenter`:

```tsx
const { registerSceneObserver } = useThreeDHopViewer();

useEffect(() => registerSceneObserver((presenter) => {
  console.log(presenter.sceneCenter, presenter.sceneRadiusInv);
}), [registerSceneObserver]);
```
