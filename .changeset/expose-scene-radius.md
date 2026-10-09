---
"@ikaros-arch/react-3dhop-iiif": minor
---

`useIIIFManifest()` now exposes `sceneRadius` (the scene's characteristic size in the model's own space units, `null` until `isSceneReady`), so consumers can scale something - e.g. an annotation spot's radius - proportionally to the object itself without needing to know whether its declared unit is millimetres or metres.
