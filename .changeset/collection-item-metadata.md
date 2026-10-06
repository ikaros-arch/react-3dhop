---
"@ikaros-arch/react-3dhop-iiif": minor
---

`parseCollection` now resolves each collection item's own `metadata` into `fields`, mirroring the manifest-level metadata parsing. The IIIF Cookbook's "Simple Collection" recipe (https://iiif.io/api/cookbook/recipe/0032-collection/) names "minimal metadata" as a property a Manifest reference may carry for presentation, specifically so a browse/listing UI can filter and display without dereferencing every Manifest — this surfaces that data instead of silently dropping it.
