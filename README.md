# react-3dhop

React component wrapper for the [3DHOP viewer](http://vcg.isti.cnr.it/3dhop/).

## Getting Started

```bash
npm install react-3dhop
```

The library ships with prebuilt assets under `dist/3dhop`. During development you can rely on the files inside `node_modules/react-3dhop/dist/3dhop`; for production remember to copy that directory (or host it elsewhere) and point `assetBaseUrl` to the published location.

Current versions of 3DHOP relies on jQuery and are not easily compatible with React. This library expects and includes a non-jQuery development version of 3DHOP.

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
} from 'react-3dhop';

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

### Compass Navigation

Add the optional `CompassNavigation` overlay to expose quick view presets and a live heading indicator:

```tsx
import { ThreeDHopViewer, CompassNavigation } from 'react-3dhop';

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
import { ThreeDHopViewer, CubeNavigation } from 'react-3dhop';

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

Annotations are opt-in via the `<Annotations>` helper. They register hotspot meshes/spots and wire the hotspot toolbar toggle automatically.

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
} from 'react-3dhop';

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
import { useThreeDHopViewer } from 'react-3dhop';

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
- `CameraControl` (perspective vs orthographic)
- `MeasureControl` (includes the measurement output panel; honours the viewer `measurementUnits` or an override passed as `units`)
- `PickControl` (includes the XYZ pick panel)
- `SectionsControl` (includes the planar section UI)
- `ScreenshotControl`
- `HotspotControl`
- `FullscreenControl`
