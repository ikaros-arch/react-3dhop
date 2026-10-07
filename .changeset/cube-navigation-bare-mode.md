---
"@ikaros-arch/react-3dhop": minor
---

`CubeNavigation` can now render a bare, icon-only cube.

Added `showHomeButton` (default `true`) and `showEdgeControls` (default `true`) to hide the attached Home button and the four per-face rotate-by-90°-increments edge strips respectively, `panelStyle` to override the panel's background/padding/shadow, and widened `labels.front`/`back`/`left`/`right`/`top`/`bottom` from `string` to `React.ReactNode` so a face can show an icon instead of text — `aria-label` on that face falls back to the English face name when the label isn't a plain string, since `aria-label` requires one.

Together these let a consumer render a minimal cube with no text, no attached buttons, and no backing panel - just six clickable faces - without fighting the component's inline styles from outside.
