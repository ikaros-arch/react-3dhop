# Extending the viewer

`@ikaros-arch/react-3dhop` 0.4 exposes the primitives its own controls are built on, so a new tool
or overlay can be written outside the package with the same guarantees: it survives scene rebuilds,
respects tool exclusivity, and follows the viewer's theme. Everything below is reached through
`useThreeDHopViewer()` or one of the hooks exported from the package root.

## The presenter's lifecycle, briefly

3DHOP's `presenter.setScene()` is not incremental: it throws away the scene — including every
helper entity — and starts loading meshes again. The viewer calls it whenever `models`, `space`,
`config`, `trackball` or a *scene contribution* changes. Meshes then stream in, and once the last
one has arrived 3DHOP flips `_isSceneReady()`.

The viewer surfaces both moments:

| Registration | Fires |
| --- | --- |
| `registerSceneObserver(fn)` | right after every `setScene`, before meshes have loaded |
| `registerSceneReadyObserver(fn)` | once per scene, when every mesh has loaded (immediately if already ready) |
| `registerTrackballObserver(fn)` | on every camera change, with the raw trackball state |
| `registerLightObserver(fn)` | whenever the light direction changes (`rotateLight`, `HomeControl`) |

All return a disposer; call it in your effect's cleanup.

## Helper geometry: `useSceneEntity`

3DHOP draws *entities* — point, line or triangle sets — over the models. Grids, axes and
measurement guides are all entities. Because `setScene` wipes them, don't call
`presenter.createEntity` directly; describe the entity and let the hook keep it alive:

```tsx
import { useSceneEntity, useSceneBounds, type SceneEntitySpec } from '@ikaros-arch/react-3dhop';

function FloorGrid({ step = 10 }: { step?: number }) {
  const { bounds } = useSceneBounds();

  useSceneEntity(
    'floor-grid',
    () => {
      if (!bounds) return null; // nothing to draw yet
      const vertices: [number, number, number][] = [];
      const y = bounds.min[1];
      for (let x = bounds.min[0]; x <= bounds.max[0]; x += step) {
        vertices.push([x, y, bounds.min[2]], [x, y, bounds.max[2]]);
      }
      for (let z = bounds.min[2]; z <= bounds.max[2]; z += step) {
        vertices.push([bounds.min[0], y, z], [bounds.max[0], y, z]);
      }
      return { type: 'lines', vertices, color: [0.8, 0.8, 0.8, 0.6], useTransparency: true } satisfies SceneEntitySpec;
    },
    [bounds, step]
  );

  return null;
}
```

The factory runs on mount, after every scene apply, once the scene is ready, and whenever `deps`
change; the entity is removed on unmount. Return `null` to draw nothing.

`SceneEntitySpec` fields map onto 3DHOP's entity: `type`, `vertices` (scene-space, i.e. the same
space picked points come back in), `color` `[r, g, b, a]`, `useTransparency`, `pointSize`, `zOff`
(depth offset, positive pushes the entity towards the camera), `visible`.

## Scene extents: `useSceneBounds`

```ts
const { bounds, refresh } = useSceneBounds();
// bounds: { min, max, center, size, radius, source } | null
```

Bounds are computed from real geometry where it exists — Nexus base-level vertices, PLY bounding
boxes — with every instance's transform (and the scene `space.transform`) applied, and fall back to
3DHOP's bounding spheres otherwise. `source` tells you which you got. Nexus meshes report a sphere
before their base level has streamed in, so after the ready signal the hook re-checks a few times
and upgrades to `'vertices'` when it can (`retryIntervalMs`, `maxRetries`).

`useSceneReady()` is the boolean version of the ready signal, for anything that should wait.

## Canvas tools: `registerInteractiveTool`

Tools that take over the canvas — measure, pick, and anything you add — are mutually exclusive.
Register yours and the viewer handles switching:

```tsx
import { useEffect, useState } from 'react';
import { useThreeDHopViewer, type InteractiveToolConfig, type Vector3 } from '@ikaros-arch/react-3dhop';

function useAngleTool() {
  const { registerInteractiveTool, toggleInteractiveTool, activeInteractiveTool } = useThreeDHopViewer();
  const [points, setPoints] = useState<Vector3[]>([]);

  useEffect(() => {
    const config: InteractiveToolConfig = {
      id: 'angle',
      // Ride on 3DHOP's pick-point mode; the viewer routes picks to whichever tool is active.
      enable: (presenter, on) => presenter.enablePickpointMode?.(on),
      isEnabled: (presenter) => presenter.isPickpointModeEnabled?.(),
      onPick: ({ raw }) => setPoints((current) => [...current, raw].slice(-3))
    };
    return registerInteractiveTool(config);
  }, [registerInteractiveTool]);

  return { active: activeInteractiveTool === 'angle', toggle: () => toggleInteractiveTool('angle'), points };
}
```

- `enable`/`isEnabled` switch and read the underlying presenter mode. Several tools can share one
  mode (the angle tool above shares pick-point mode with `PickControl`); exclusivity is by tool id.
- `onPick` receives `{ raw, corrected, presenter }`: `raw` is what 3DHOP reported and is what you
  feed back into entities; `corrected` has the viewer's `coordinateCorrections` applied and is what
  you show the user. While a tool with `onPick` is active, the shared `pickpointValue` is not
  updated.
- A toolbar image whose `data-hop-id` is the tool id (or `<id>_on`) toggles it through the legacy
  `actionsToolbar` path as well, so tools can be dropped into the stock toolbar markup.
- `activeInteractiveTool` on the context re-renders when the active tool changes.

### Snapshotting a tool's in-progress state

If you're saving custom "views" (camera position plus whatever the user was in the middle of
measuring) you need a way to capture and restore a tool's picked points alongside the camera. Add
`captureState`/`restoreState` to the config:

```tsx
const config: InteractiveToolConfig = {
  id: 'angle',
  enable: (presenter, on) => presenter.enablePickpointMode?.(on),
  onPick: ({ raw }) => setPoints((current) => [...current, raw].slice(-3)),
  captureState: () => points,
  restoreState: (state) => setPoints(Array.isArray(state) ? (state as Vector3[]) : [])
};
```

```ts
const { captureToolState, restoreToolState } = useThreeDHopViewer();

const saved = captureToolState();              // { toolId, state } for the active tool, or null
const saved2 = captureToolState('angle');       // a specific tool, active or not
restoreToolState('angle', saved!.state);        // activates 'angle' first if it wasn't already
```

Only implement these if the tool's state genuinely lives somewhere this wrapper can read. All three
built-in tools support it: `pick`'s single point is already in `pickpointValue`; `measure`'s two
points are reported by `presenter._onEndMeasurement(measure, pointA, pointB)` once a measurement
completes, and restored via `presenter.restoreMeasurement(pointA, pointB)` (added to the vendored
3DHOP build specifically for this — see `packages/3dhop/PROVENANCE.md`, Layer 3). `measure`'s
`captureState` reports `null` before any measurement has finished, since there's nothing to restore
yet — `captureToolState()` still returns `{ toolId: 'measure', state: null }` in that case, not
`null` itself, so check `.state` rather than the whole result.

## Light direction: `useLightDirection`

```ts
const { direction, setFromDisc, isLightTrackballEnabled } = useLightDirection();
```

`direction` is 3DHOP's `_lightDirection` (unit vector towards the light). `setFromDisc(x, y)` calls
`rotateLight` with a point in the unit disc — `x`, `y` in `[-0.5, 0.5]`, `y` down. Both
`LightControl` (drag on canvas) and `HomeControl` keep it in step.

## Theming

Every colour the viewer's own UI uses is a CSS custom property with the stock look as its fallback:

```css
.my-viewer {
  --r3dhop-panel-bg: rgba(20, 20, 24, 0.8);
  --r3dhop-accent: #6cf;
}
```

| Token | Used by |
| --- | --- |
| `--r3dhop-panel-bg`, `--r3dhop-panel-text` | toolbar sidecars (measure/pick/sections/info) |
| `--r3dhop-overlay-bg`, `--r3dhop-overlay-bg-strong`, `--r3dhop-overlay-text`, `--r3dhop-overlay-border`, `--r3dhop-overlay-shadow` | compass, cube, future overlays |
| `--r3dhop-control-bg`, `--r3dhop-control-bg-hover`, `--r3dhop-control-border` | interactive surfaces inside overlays |
| `--r3dhop-ink`, `--r3dhop-accent` | drawn indicators (compass ring and needle) |

Or set the prop: `<ThreeDHopViewer theme="dark" />` (`'light' | 'dark' | 'system'`). The root
element carries `data-r3dhop-theme="light|dark"` for your own selectors. `dark` is applied as
inline custom properties; `light` sets none, so stylesheet overrides win. Nothing is persisted —
store the choice yourself and pass it back in.

In your own components use `themeVar('token')` for inline styles, or `readThemeToken(element,
'token')` when drawing to a canvas.

## Custom toolbar icons

Every built-in control's `icon` prop accepts `string | React.ReactNode`. A string is resolved as
an image URL against `assetBaseUrl`, exactly like the bundled skin icons; anything else (e.g. an
icon-font glyph) renders as-is in the same slot, with the same `id`/`data-hop-id` plumbing so
hover/click wiring and visibility syncing keep working:

```tsx
<MeasureControl icon={{ enabled: <i className="bi bi-rulers" />, disabled: <i className="bi bi-rulers" /> }} />
<HomeControl icon={<i className="bi bi-house-fill" />} />
```

Building a fully custom control on top of `ToggleImagePair`? `ToggleImageConfig.icon` takes the
same `string | React.ReactNode`, and `resolveControlIcon(assetBaseUrl, override, fallback)` gives
you the built-ins' exact fallback behavior (string override resolves against `assetBaseUrl`, a
ReactNode override passes straight through, `undefined` resolves the bundled default).

## Driving toolbar actions from outside `#toolbar`

`MeasureControl`, `PickControl`, `AngleControl`, `SectionsControl` and `GridControl` have real
React-level APIs (`registerInteractiveTool`/`toggleInteractiveTool`, or a controlled `mode` prop)
that work no matter where their icon ends up in the DOM. `LightingControl`, `ColorControl`,
`SpecularControl`, `TransparencyControl`, `CameraControl` and `HomeControl` don't — they have no
toggle state of their own, and normally only work because the vendored 3DHOP `init.js` wires a
native click listener, once, to toolbar icons inside `#toolbar`. Render one of those controls'
icons somewhere else — a custom sidebar panel instead of the toolbar, say — and clicking it will
silently do nothing: no error, just no effect, because nothing ever calls that listener for an
element outside `#toolbar`, or for one that was mounted after the one-time scan that wires it up.

`triggerToolbarAction(action)` on `useThreeDHopViewer()` runs an action exactly as if its icon had
been clicked in the real toolbar — first any handler registered via `registerToolbarAction`, then
the built-ins (`'home'`, `'zoomin'`, `'zoomout'`, `'lighting'`, `'color'`, `'specular'`,
`'transparency'`, `'perspective'`/`'orthographic'`, `'hotspot'`, `'full'`, `'info'`,
`'screenshot'`). Wire it to your own icon's click handler, using the id the control itself renders:

```tsx
function SidebarLightingToggle() {
  const { triggerToolbarAction } = useThreeDHopViewer();
  return (
    <LightingControl
      icon={{
        enabled: <span onClick={() => triggerToolbarAction('lighting')}><i className="bi bi-lightbulb-fill" /></span>,
        disabled: <span onClick={() => triggerToolbarAction('lighting')}><i className="bi bi-lightbulb-fill" /></span>
      }}
    />
  );
}
```

The resulting visibility sync (which icon of the pair shows) already works regardless of DOM
location — it's driven by `document.querySelectorAll('[data-hop-id="..."]')`, not scoped to
`#toolbar` — so this one call is all a custom layout needs.

## Testing without WebGL

The package's own tests run against a presenter double (`packages/react-3dhop/test/mockPresenter.ts`)
and a `ViewerHarness` that provides the context with real registries but no 3DHOP scripts. If you
build on these hooks, the same approach works for you: render your component inside a provider,
fire `applyScene` / `finishLoading`, and assert on the mock's `_scene.entities` or on spies.
