# 3DHOP asset provenance

These files are a vendored copy of [3DHOP](https://github.com/cnr-isti-vclab/3DHOP), not a
dependency. This file records exactly how they differ from upstream so a future version bump
can tell local changes from upstream ones.

## Base

Upstream `cnr-isti-vclab/3DHOP@master`, `minimal/js/`, version **4.3**. At the time of writing
`4.3` is both the latest tag and the state of `master`.

## Layer 1 — de-jQuery rewrite (local, this repo)

3DHOP's `init.js` drives its UI with jQuery. jQuery does not coexist well with React's ownership
of the DOM, so **`js/init.js` has been rewritten against the plain DOM API**. It is the only
locally rewritten file, and jQuery is no longer vendored or loaded at all.

- `js/jquery.js` has been deleted.
- `js/jquery.js` has been removed from `SCRIPT_RESOURCES` in `src/viewer/assets.ts`.
- The two sample pages bootstrap with `DOMContentLoaded` instead of `$(document).ready()`.
  (`3DHOP_all_tools.html` was already converted; `3DHOP_no_tools.html` was converted here.)

**Invariant to preserve: no file in `3dhop/js/` may call `jQuery(...)` or use jQuery's `$`.**
Verify with:

```bash
grep -c 'jQuery(' packages/react-3dhop/3dhop/js/*.js   # must be 0 everywhere
```

Note that `spidergl.js` contains the substrings `requests$(` and `muls$(`. These are ordinary
minified identifiers, not jQuery calls.

## Layer 2 — the "4.3.5" patch set

`presenter.js` reports `HOP_VERSION = "4.3.5"`. **This is not an upstream release.** It comes
from the build running in the `khm_3dhop_desktop` project, added there by a commit titled
"update from server", and was adopted here for parity between the two projects.

Files taken from that build, with their diff size against upstream 4.3:

| File | Changed lines vs upstream 4.3 |
| --- | --- |
| `js/presenter.js` | 90 |
| `js/nexus.js` | 112 |
| `js/trackball_sphere.js` | 302 |
| `js/nexus.monitor.js` | 22 |
| `js/trackball_rail.js` | 14 |
| `js/trackball_turntable_pan.js` | 14 |
| `js/trackball_pantilt.js` | 8 |
| `js/trackball_turntable.js` | 6 |

Notable behavioural changes:

- `presenter.setScene` now calls `trackball.setup(trackOptions, presenter)` — the trackballs take
  a second argument. **Presenter and all five trackball files must be upgraded as a set.**
- Helper geometry (picked points, measurements) gained its own `entity.pointSize`, separate from
  the still-present `scene.config.pointSize` that governs model point clouds.
- New `_saveImage` helper, plus `config.autoSaveScreenshot`, `config.screenshotBaseName` and
  `config.screenshotTime` controlling screenshot output and filenames.
- `space.cameraType` (`"perspective"` | `"orthographic"`) is now a scene-level setting.
- The light trackball gained `onMouseButtonUp` and tracks drag deltas relative to canvas size
  rather than a fixed divisor.

Deliberately **not** adopted: that build's `js/init.js`. Its only differences from upstream 4.3
are the toolbar auto-repeat interval (100 ms → 150 ms), a jQuery call this repo had already
removed, and two commented-out `preventDefault()` calls — nothing worth giving up the
de-jQueryed rewrite for.

## Unmodified from upstream 4.3

`js/ply.js`, `js/corto.js`, `js/corto.em.js`, `js/meco.js`, `js/helpers.js`, `js/spidergl.js`,
and everything under `skins/`, `stylesheet/`, `models/`, `models-system/`, `annotations/`.
