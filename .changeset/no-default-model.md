---
"@ikaros-arch/react-3dhop": minor
---

`<ThreeDHopViewer>` no longer falls back to a bundled sample model. With neither `modelUrl` nor
`models` it renders an empty scene; a `models` entry without its own `url` inherits `modelUrl`, and
is skipped with a console warning if there is none.
