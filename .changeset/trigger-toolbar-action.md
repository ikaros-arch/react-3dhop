---
"@ikaros-arch/react-3dhop": minor
---

Added `triggerToolbarAction(action)` to `useThreeDHopViewer()`.

`LightingControl`, `ColorControl`, `SpecularControl`, `TransparencyControl`, `CameraControl` and `HomeControl` have no toggle state of their own — they only work because the vendored 3DHOP `init.js` wires a native click listener, once, to toolbar icons inside `#toolbar`. Rendering one of those controls' icons outside the toolbar (e.g. a custom sidebar panel) silently did nothing when clicked, since nothing ever called that listener for an element outside `#toolbar` or mounted after the page's one-time init scan.

`triggerToolbarAction(action)` runs a toolbar action by id exactly as if its icon had been clicked in the real toolbar — first any handler registered via `registerToolbarAction`, then the built-ins (`home`, `zoomin`, `zoomout`, `lighting`, `color`, `specular`, `transparency`, `perspective`/`orthographic`, `hotspot`, `full`, `info`, `screenshot`) — so these controls can be driven correctly from anywhere in the tree. See "Driving toolbar actions from outside `#toolbar`" in docs/extending.md.
