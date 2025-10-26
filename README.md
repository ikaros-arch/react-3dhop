# react-3dhop

React component wrapper for the [3DHOP viewer](http://vcg.isti.cnr.it/3dhop/).

## Getting Started

```bash
npm install react-3dhop
```

The library ships with prebuilt assets under `dist/3dhop`. During development you can rely on the files inside `node_modules/react-3dhop/dist/3dhop`; for production remember to copy that directory (or host it elsewhere) and point `assetBaseUrl` to the published location.

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

`useThreeDHopViewer` exposes the active presenter alongside helper registries so that custom components can contribute meshes/spots, register extra toolbar handlers, or observe scene reloads.

```tsx
import { useEffect } from 'react';
import { useThreeDHopViewer } from 'react-3dhop';

export function CustomPlugin() {
	const { registerToolbarAction, presenter } = useThreeDHopViewer();

	useEffect(() => registerToolbarAction('reset-light', (instance) => {
		instance.enableLightTrackball(false);
		return true;
	}), [registerToolbarAction]);

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
