---
"@ikaros-arch/react-3dhop": minor
---

Reworked `SectionsControl` to drive the presenter's clipping methods (`setClippingX/Y/Z`, `setClippingPointX/Y/Z`, `setClippingRendermode`, …) directly from React state, instead of the legacy sidecar that relied on fixed DOM ids (`xplaneSlider`, `showPlane`, …) picked up by `init.js`'s `sectiontoolInit`/`sectionxSwitch`/`sectiontoolReset` globals. Those globals are no longer called or declared on `window`.

**Breaking:** the `planeLabels` prop is renamed `axisLabels`. Any CSS or script in consuming apps that targeted the old ids (`#xplaneSlider`, `#showPlane`, `#sections-box img`, …) will need updating — the sidecar no longer renders them. Multiple `SectionsControl` instances (e.g. one per `Toolbar` corner) now work correctly, since nothing is looked up by a page-wide id anymore.

New controlled/uncontrolled props mirroring the rest of the Phase-1 controls: `open`/`defaultOpen`/`onOpenChange` for the master toggle, `state`/`defaultState`/`onStateChange` (shape: `{ x, y, z, showPlanes, showEdges }`, each axis `{ enabled, position, flip }`) for the per-axis clipping. Clipping state now survives a scene rebuild exactly as set, where the legacy sidecar reset every slider back to the midpoint on every reload.

`PresenterInstance` gains typed `setClippingX/Y/Z`, `setClippingXYZ`, `getClippingX/Y/Z`, `setClippingPointX/Y/Z`, `setClippingPointXYZ`, `setClippingRendermode`, `getClippingRendermode`.
