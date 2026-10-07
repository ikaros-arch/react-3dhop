---
"@ikaros-arch/react-3dhop": minor
---

Added `faceStyle` to `CubeNavigation`, merged onto every face uniformly (background/color/border/...). The default face colour comes from the `--r3dhop-control-bg`/`--r3dhop-overlay-text` theme tokens, which may not read well against every backdrop (e.g. a dark-themed app wants a different cube tone than its light theme, independent of those shared tokens) - `faceStyle` lets a consumer override it directly without fighting the component's inline styles from outside.

Also documented that `panelStyle` only overrides the specific properties it sets: the panel's `cube-navigation-panel` div also carries a plain `panel` class for consumers who want to hook into it, which can collide with an app's own same-named utility class (as it did in BItFROST-khm) - anything `panelStyle` doesn't mention (e.g. `border`) still comes from whatever stylesheet rule matches that class.
