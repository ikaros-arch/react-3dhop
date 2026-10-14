---
"@ikaros-arch/react-3dhop-iiif": minor
---

`ViewerState`/saved views now also carry scene-wide transparency and specular-highlight state (distinct from `modelTransparency`, which is per-model). Both have real getter+setter pairs on the presenter (`isInstanceTransparencyEnabled`/`setInstanceTransparency`, and the newly-exposed `isInstanceSpecularEnabled`/`setInstanceSpecularity` from `@ikaros-arch/3dhop` 0.6.0+), so — like lighting — they're always read live rather than session-tracked. New context methods: `isSceneTransparencyEnabled`/`setSceneTransparency`, `isSceneSpecularEnabled`/`setSceneSpecular`. `captureViewerState`/`applyViewerState`/`saveCurrentView`/`goToCamera` all pick these up automatically.
