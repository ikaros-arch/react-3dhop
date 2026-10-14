---
"@ikaros-arch/react-3dhop-iiif": minor
---

`useIIIFManifest()` gains `captureViewerState()`/`applyViewerState()`, the model visibility/transparency/solid-colour/lighting logic `saveCurrentView`/`goToCamera` already used internally, now exposed directly for apps with their own saved-view concept that isn't `saveCurrentView`'s IIIF annotation shape. `saveCurrentView`/`goToCamera` are refactored to use these themselves — no behaviour change for existing callers.
