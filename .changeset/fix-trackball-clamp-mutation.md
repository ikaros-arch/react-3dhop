---
"@ikaros-arch/3dhop": patch
---

Fix trackball `setup()` mutating the caller's `minMaxPhi`/`minMaxTheta` (or `minMaxAngleX`/`minMaxAngleY`) clamp arrays in place while converting them from degrees to radians. Harmless upstream (where `setup()` runs once per page load), but react-3dhop reconstructs the trackball on every `setScene()` with a reused `trackOptions` object, so a second conversion of the same array re-converted already-converted radians - shrinking the rotation clamp range by ~57x on every structural scene update (e.g. adding an annotation spot) until rotation was clamped to almost nothing. Affects `trackball_turntable.js`, `trackball_turntable_pan.js`, `trackball_rail.js`, and `trackball_pantilt.js`.
