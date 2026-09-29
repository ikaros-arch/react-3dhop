---
"@ikaros-arch/react-3dhop": minor
---

Add `GridControl` (toolbar toggle with a floor / box / fixed / axes mode picker) and the headless `GridOverlay`, plus the `buildFlatGrid` / `buildBoxGrid` / `buildFixedGrid` / `buildAxes` / `gridStepForUnit` geometry helpers. Grids follow the loaded scene's bounds, size their cells from the viewer's `measurementUnits`, and survive scene rebuilds. Ported from the BITFROST viewer.
