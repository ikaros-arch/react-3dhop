# react-3dhop

React component wrapper for the [3DHOP viewer](http://vcg.isti.cnr.it/3dhop/).

## Getting Started

```bash
npm install
npm run build
```

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

By default the viewer loads everything from `/node_modules/react-3dhop/dist/3dhop`, which is the asset folder published with this package. Override `assetBaseUrl` if you prefer to serve the files from another location (for example a `public/3dhop` directory or a CDN). For production builds remember to copy the contents of `node_modules/react-3dhop/dist/3dhop` to a static location that your bundler will ship.

### Customising the toolbar

- Omit children to render the default toolbar.
- Use the provided `Toolbar` and control components to choose layout, icons, and titles.
- Pass `showToolbar={false}` to hide it entirely.
