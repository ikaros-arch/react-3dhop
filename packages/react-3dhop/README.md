# @ikaros-arch/react-3dhop

React component wrapper for the [3DHOP viewer](https://3dhop.net/) by the Visual Computing Lab,
ISTI-CNR.

## Getting Started

```bash
npm install @ikaros-arch/react-3dhop @ikaros-arch/3dhop
```

`@ikaros-arch/3dhop` is a peer dependency: it holds the 3DHOP runtime itself (JavaScript, CSS,
toolbar skins) in a **jQuery-free build**, with no React code. This package loads those files at
runtime from a URL rather than bundling them, so you have to make the package directory
reachable from your page and tell the viewer where it is with the `assetBaseUrl` prop:

- **Development** — the default `assetBaseUrl` is `/node_modules/@ikaros-arch/3dhop`, which works
  when your dev server serves `node_modules` (plain Vite does; the demo in this repository shows a
  small plugin that serves it from `/3dhop` instead).
- **Production** — copy `node_modules/@ikaros-arch/3dhop` into your static output (or host it on a
  CDN) and pass that URL as `assetBaseUrl`.

Upstream 3DHOP relies on jQuery and is not easily compatible with React; the build in
`@ikaros-arch/3dhop` has jQuery written out, and jQuery is neither vendored nor loaded. What that
build is and how it differs from upstream is recorded in its
[`PROVENANCE.md`](https://github.com/ikaros-arch/react-3dhop/blob/main/packages/3dhop/PROVENANCE.md).

There is no bundled default model: pass a `modelUrl` or a `models` map. Without either the viewer
renders an empty scene (background only), which is also what you get while a model URL is still
being resolved.

Longer-form documentation lives in
[`docs/`](https://github.com/ikaros-arch/react-3dhop/blob/main/docs/README.md) in the repository.

### Basic Viewer

```tsx
import {
	ThreeDHopViewer,
	Toolbar,
	HomeControl,
	ZoomInControl,
	ZoomOutControl,
	LightControl,
	FullscreenControl
} from '@ikaros-arch/react-3dhop';

export function Example() {
	return (
		<ThreeDHopViewer width={640} height={480}>
			<Toolbar position="top-right">
				<HomeControl />
				<ZoomInControl />
				<ZoomOutControl />
				<LightControl />
				<FullscreenControl />
			</Toolbar>
		</ThreeDHopViewer>
	);
}
```

The canvas background defaults to the bundled light vignette. Supply `backgroundUrl` to point at a different image (relative paths resolve against `assetBaseUrl`) or pass `null` to remove the inline background entirely.

Set the `measurementUnits` prop on `ThreeDHopViewer` to change the label appended to measurement results (defaults to `mm`). Individual `MeasureControl` instances can override this with their own `units` prop when desired. Both the measurement and pick outputs include a built-in copy button for quick clipboard access. When your source models are stored with shortened coordinates (for example, large UTM offsets trimmed in the `.nxz`), supply `coordinateCorrections={{ x: ..., y: ..., z: ... }}` to re-apply those offsets to any exposed coordinates so the pick output reflects real-world positions.

### Multiple Models

Pass a `models` map to load several meshes at once and configure each instance independently. Keys become identifiers in the generated scene; any invalid characters are sanitised automatically.

```tsx
import {
	ThreeDHopViewer,
	Toolbar,
	HomeControl,
	TransparencyControl,
	type AnnotationDefinition
} from '@ikaros-arch/react-3dhop';

const primaryAnnotations: AnnotationDefinition[] = [
	{ id: 'base', label: 'Statue Base', position: [-113.6, 11.54, -48.16], radius: 5.4 }
];

export function MultiModelScene() {
	return (
		<ThreeDHopViewer
			width={640}
			height={480}
			models={{
				primary: {
					url: '/models/statue.nxz',
					annotations: primaryAnnotations
				},
				shadow: {
					url: '/models/statue.nxz',
					transform: { translation: [0, 0, -80] },
					scale: 0.95,
					useSolidColor: true,
					color: [0.6, 0.75, 1],
					transparency: { enabled: true, alpha: 0.25 }
				}
			}}
		>
			<Toolbar position="top-left">
				<HomeControl />
				<TransparencyControl />
			</Toolbar>
		</ThreeDHopViewer>
	);
}
```

Each model definition accepts optional transforms (`translation`, `rotation`, `scale`), per-instance colours, tags, transparency/specular overrides, and inline hotspot annotations. The legacy `modelUrl` prop still works for simple single-model viewers—omit `models` to fall back to it.

### Scene Configuration

`space`, `config`, `trackball` and `nexusTargetError` reach the presenter's scene-level settings: how the scene is framed and projected, how clipping borders and point clouds are drawn, which trackball is used, and how aggressively Nexus streams detail.

```tsx
<ThreeDHopViewer
	models={models}
	space={{ centerMode: 'scene', radiusMode: 'scene', cameraFOV: 45 }}
	config={{ showClippingBorder: true, clippingBorderSize: 0.002 }}
	trackball={{ type: 'SphereTrackball', trackOptions: { startDistance: 2.0 } }}
	nexusTargetError={0.8}
/>
```

`space` and `config` are forwarded field by field, so anything you leave out keeps 3DHOP's own default. Set `centerMode`/`radiusMode` to `'scene'` when several models sit at different positions—the default frames the first instance only. `trackball.type` takes the name of one of 3DHOP's trackballs (`TurnTableTrackball`, `TurntablePanTrackball`, `PanTiltTrackball`, `SphereTrackball`, `RailTrackball`) so you never have to reach into `window`; a constructor is also accepted for custom trackballs.

All three are compared structurally, so inline object literals do not rebuild the scene on every render. Every field is listed in [docs/scene-configuration.md](https://github.com/ikaros-arch/react-3dhop/blob/main/docs/scene-configuration.md).

### Compass Navigation

Add the optional `CompassNavigation` overlay to expose quick view presets and a live heading indicator:

```tsx
import { ThreeDHopViewer, CompassNavigation } from '@ikaros-arch/react-3dhop';

export function WithCompass() {
	return (
		<ThreeDHopViewer width={640} height={480}>
			<CompassNavigation position="top-right" />
		</ThreeDHopViewer>
	);
}
```

The component renders its own panel (defaulting to the top-right corner) and wires up north/east/south/west selectors, a top-view shortcut, home reset, and a projection toggle. Set `preservePanAndDistance={false}` to snap the camera back to the default pan/zoom for each preset, adjust `compassSize` to resize the canvas, or override button captions through the `labels` prop.
Use `animationSeconds` (defaults to `0.8`) to control the easing duration passed to the underlying 3DHOP trackball animator.

### Cube Navigation

Prefer a more spatial orientation indicator? Drop in the `CubeNavigation` overlay. It renders a CSS 3D cube that mirrors the current trackball heading and lets users click any face to animate the main scene into that view.

```tsx
import { ThreeDHopViewer, CubeNavigation } from '@ikaros-arch/react-3dhop';

export function WithCube() {
	return (
		<ThreeDHopViewer width={640} height={480}>
			<CubeNavigation position="bottom-left" />
		</ThreeDHopViewer>
	);
}
```

Face labels default to the cardinal directions plus top/bottom; override them through the `labels` prop. When a face is head-on, directional edge panels remain clickable so you can roll to adjacent sides (left/right) or shift to top/bottom without hunting for hidden faces—tweak their captions with the optional `edgeLabels` prop. Set `cubeSize` to resize the cube, adjust `targetDistance` if you disable `preservePanAndDistance`, and keep the camera projection toggle handy with `showProjectionToggle` (enabled by default).

### Optional Hotspot Annotations

Annotations are opt-in. Supply an `annotations` array on any model definition, or render the `<Annotations>` helper when you prefer to register hotspots from child components. Either approach wires the hotspot meshes and automatically synchronises the toolbar toggle.

```tsx
import { useState } from 'react';
import {
	ThreeDHopViewer,
	Toolbar,
	HomeControl,
	ZoomInControl,
	ZoomOutControl,
	HotspotControl,
	Annotations,
	type AnnotationDefinition
} from '@ikaros-arch/react-3dhop';

const spots: AnnotationDefinition[] = [
	{ id: 'base', label: 'Statue Base', position: [-113.6, 11.54, -48.16], radius: 5.4 },
	{ id: 'shoulder', label: 'Shoulder', position: [-52.06, 180.34, -5.91], radius: 2.35 }
];

export function WithHotspots() {
	const [picked, setPicked] = useState<string | null>(null);

	return (
		<ThreeDHopViewer modelUrl="/models/C42183_sID-576_mID-913.nxz">
			<Toolbar position="top-left">
				<HomeControl />
				<ZoomInControl />
				<ZoomOutControl />
				<HotspotControl />
			</Toolbar>
			<Annotations
				annotations={spots}
				expanded
				onAnnotationPick={({ id, annotation }) => setPicked(`${id}: ${annotation.label ?? 'Untitled'}`)}
			/>
			{picked ? <div className="annotation-output">Last annotation: {picked}</div> : null}
		</ThreeDHopViewer>
	);
}
```

If you omit a custom toolbar the default viewer toolbar automatically includes `HotspotControl` when any hotspot contributions are present.

### Viewer Extension Points

`useThreeDHopViewer` exposes the active presenter alongside helper registries so that custom components can contribute meshes/spots, register extra toolbar handlers, subscribe to trackball updates, or observe scene reloads.

```tsx
import { useEffect } from 'react';
import { useThreeDHopViewer } from '@ikaros-arch/react-3dhop';

export function CustomPlugin() {
	const { registerToolbarAction, registerTrackballObserver, presenter } = useThreeDHopViewer();

	useEffect(() => registerToolbarAction('reset-light', (instance) => {
		instance.enableLightTrackball(false);
		return true;
	}), [registerToolbarAction]);

	useEffect(() => registerTrackballObserver((state) => {
		console.log('phi', state[0], 'theta', state[1]);
	}), [registerTrackballObserver]);

	useEffect(() => {
		if (!presenter) return;
		presenter.enableSceneLighting?.(true);
	}, [presenter]);

	return null;
}
```

### Customising the toolbar

- Omit children to render the default toolbar.
- Use the provided `Toolbar` and control components to choose layout, icons, and titles.
- Pass `showToolbar={false}` to hide it entirely.
- Render multiple `Toolbar` instances if you need controls in different corners; the viewer keeps the button state in sync across every toolbar. (Planar section sliders still rely on the legacy single-panel markup, so stick to one `SectionsControl` for now.)

Available controls mirror the classic 3DHOP toolbar:

- `HomeControl`
- `ZoomInControl` / `ZoomOutControl`
- `LightingControl` (scene lighting toggle)
- `LightControl` (interactive light trackball)
- `ColorControl` (solid colour toggle)
- `TransparencyControl` (opacity toggle for all instances)
- `SpecularControl` (toggle specular highlights across instances)
- `CameraControl` (perspective vs orthographic)
- `MeasureControl` (includes the measurement output panel; honours the viewer `measurementUnits` or an override passed as `units`)
- `PickControl` (includes the XYZ pick panel)
- `AngleControl` (three-point angle measurement; see below)
- `SectionsControl` (includes the planar section UI)
- `InfoControl` (toggles a static info panel with custom content)
- `ScreenshotControl`
- `HotspotControl`
- `FullscreenControl`

Controls beyond the classic toolbar (ported from the BITFROST viewer at KHM, University of Oslo):

#### `AngleControl`

Measures the angle between three points picked on the model. It shares 3DHOP's pick-point mode
with `PickControl`, so the two are mutually exclusive; the picked points, both arms and a
translucent wedge are drawn as scene entities, and the angle appears in a sidecar with a copy
button. A fourth pick starts a new measurement.

```tsx
<Toolbar position="top-left">
	<MeasureControl />
	<PickControl />
	<AngleControl digits={1} onAngle={(degrees, points) => console.log(degrees, points)} />
</Toolbar>
```

Props: `title` / `icon` / `enabledImgProps` / `disabledImgProps` (as for the other toggles),
`label`, `digits` (default 2), `initialDisplayValue`, `onAngle(degrees, [a, b, c])`. The tool id is
`'angle'` for `toggleInteractiveTool` / `activeInteractiveTool`.

### Theming

Pass `theme="dark"` (or `"system"`) to `<ThreeDHopViewer>`, or set any of the `--r3dhop-*` CSS custom
properties on an ancestor to restyle the viewer's own panels and overlays. The root element carries
`data-r3dhop-theme` for your own selectors. Token list and details in
[docs/extending.md](https://github.com/ikaros-arch/react-3dhop/blob/main/docs/extending.md#theming).

### Building your own tools and overlays

The hooks the built-in controls use are exported: `useSceneEntity` keeps helper geometry alive
across scene rebuilds, `useSceneBounds` gives the loaded scene's extents, `registerInteractiveTool`
(on the viewer context) adds a canvas tool that is mutually exclusive with measure/pick, and
`useLightDirection` reads and sets the light. See
[docs/extending.md](https://github.com/ikaros-arch/react-3dhop/blob/main/docs/extending.md).

## Licence

GPL-3.0-or-later. 3DHOP itself is GPL-3.0, and this wrapper is a derivative of it, so applications
that ship it are bound by the GPL as well. `@ikaros-arch/3dhop` is an unofficial packaging of
3DHOP and is not affiliated with CNR-ISTI.
