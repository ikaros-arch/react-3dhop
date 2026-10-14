---
"@ikaros-arch/3dhop": minor
---

Added `presenter.isInstanceSpecularEnabled(tag)`, alongside `setInstanceSpecularity`, mirroring `isInstanceTransparencyEnabled`'s tag-scoped structure but checking `specularColor` for a non-zero RGB instead of `useTransparency`. There was previously no way to read current specular state; this exposes logic `@ikaros-arch/react-3dhop` already computed inline for its own toolbar icon sync.
