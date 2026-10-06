---
"@ikaros-arch/react-3dhop": minor
"@ikaros-arch/3dhop": minor
---

`InteractiveToolConfig` gained optional `captureState`/`restoreState`, and the viewer context gained `captureToolState()`/`restoreToolState()`, so an app can snapshot a tool's in-progress picked points (e.g. to persist alongside a saved camera view) and restore them later. Wired up for `AngleControl` and the built-in `pick` and `measure` tools — `measure` needed a small addition to the vendored 3DHOP presenter (`restoreMeasurement(pointA, pointB)`) since it previously had no way to redisplay a completed measurement without the user re-picking both points; see `packages/3dhop/PROVENANCE.md`.
