---
"@ikaros-arch/react-3dhop": minor
---

Exported `getHopAllTag()`, the reserved tag meaning "every instance" that `toggleInstanceSolidColor`/`setInstanceTransparency`/`setInstanceSpecularity` expect as their scene-wide target. Previously internal; `@ikaros-arch/react-3dhop-iiif` needs it to drive the scene-wide solid-colour toggle from outside this package.
