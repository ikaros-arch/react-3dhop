---
"@ikaros-arch/react-3dhop": patch
---

Fixes found while smoke-testing the new controls:

- The active interactive tool (measure / pick / angle …) is re-enabled after every scene apply. 3DHOP's `setScene` silently resets its measurement flags, so a parent re-render that changed the `models` object identity used to leave the toolbar showing a tool as active while the presenter had switched it off.
- `CubeNavigation`, `CompassNavigation` and the view presets now send `[phi, theta, distance]` to the plain `TurnTableTrackball` (the default) instead of the six-value pan-trackball form, which was being read as distance 0.
