# 3DHOP asset provenance

These files are a vendored copy of [3DHOP](https://github.com/cnr-isti-vclab/3DHOP), not a
dependency. This file records exactly how they differ from upstream so a future version bump
can tell local changes from upstream ones.

## Base

Upstream `cnr-isti-vclab/3DHOP@master`, `minimal/js/`, version **4.3**. At the time of writing
`4.3` is both the latest tag and the state of `master`.

## Layer 1 — de-jQuery `init.js` (Federico Ponchio, CNR-ISTI, October 2025)

3DHOP's upstream `init.js` drives its UI with jQuery, which does not coexist well with React's
ownership of the DOM. **The jQuery-free `js/init.js` in this repo was written by Federico Ponchio
(Visual Computing Lab, ISTI-CNR).** After a request in
September 2025 asking whether jQuery could be written out of 3DHOP for a React integration, he
assessed that all jQuery calls lived in `init.js` and were replaceable with modern JS, and on
2025-10-24 shared a "minimal 3DHOP" build with jQuery removed
(`https://vcg-legacy.isti.cnr.it/~ponchio/minimal.zip`). That build is the base of this repo's
initial commit (2025-10-25); `init.js` has not been modified since, only moved. The upstream
GPL-3 header is retained.

In Ponchio's build, `3DHOP_all_tools.html` already bootstrapped with `DOMContentLoaded` instead
of `$(document).ready()`, but `js/jquery.js` was still present in the folder.

Local follow-ups in this repo (2026-09):

- `js/jquery.js` has been deleted; jQuery is no longer vendored or loaded at all.
- `js/jquery.js` has been removed from `SCRIPT_RESOURCES` in `src/viewer/assets.ts`.
- `3DHOP_no_tools.html` was converted to `DOMContentLoaded` as well.

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
are the toolbar auto-repeat interval (100 ms → 150 ms), a jQuery call that Ponchio's rewrite had
already removed, and two commented-out `preventDefault()` calls — nothing worth giving up the
de-jQueryed `init.js` for.

## Unmodified from upstream 4.3

`js/ply.js`, `js/corto.js`, `js/corto.em.js`, `js/meco.js`, `js/helpers.js`, `js/spidergl.js`,
and everything under `skins/`, `stylesheet/`, `models/`, `models-system/`, `annotations/`.
