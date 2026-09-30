---
"@ikaros-arch/react-3dhop": minor
---

Add `AngleControl`, a toolbar toggle that measures the angle between three picked points (drawn as scene entities with a translucent wedge) and shows the result in a copyable sidecar. Ported from the BITFROST viewer. Also exports the `computeAngle` / `angleEntities` / `formatAngle` geometry helpers, the toolbar building blocks (`ToggleImagePair`, `CopyableOutput`, `useToolbarSidecar`, `useToolbarAssets`, `resolveToggleIcon`) and `useOptionalThreeDHopViewer`; the viewer context gains `realignToolbar()`, and toolbar sidecars may declare their anchor icons with `data-hop-anchor`. Requires `@ikaros-arch/3dhop` ≥ 0.3.0 for the new icons.
