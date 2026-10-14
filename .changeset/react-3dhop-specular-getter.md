---
"@ikaros-arch/react-3dhop": minor
---

`PresenterInstance` gains `isInstanceSpecularEnabled?(tag?)`, matching the new `@ikaros-arch/3dhop` method. `toolbarSync.ts`'s internal `syncSpecularUi` now calls it instead of duplicating the same non-zero-`specularColor` check inline — no behaviour change, just one source of truth for the check.
