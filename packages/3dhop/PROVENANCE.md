# 3DHOP asset provenance

These files are a vendored copy of [3DHOP](https://github.com/cnr-isti-vclab/3DHOP), published
as the npm package `@ikaros-arch/3dhop`. This file records exactly how they differ from upstream
so a future version bump can tell local changes from upstream ones, and which licence each file
is under.

## Licences

3DHOP as a whole is GPL-3.0 (upstream `LICENSE.txt`, copied here). Several of its components
come from sibling VCLab projects under more permissive licences and keep their own headers:

| Files | Licence | Origin |
| --- | --- | --- |
| `js/init.js`, `js/presenter.js`, `js/ply.js`, `js/helpers.js`, `js/trackball_*.js` | GPL-3.0-or-later | 3DHOP |
| `js/nexus.js`, `js/nexus.monitor.js`, `js/meco.js` | MIT | [Nexus](https://github.com/cnr-isti-vclab/nexus) |
| `js/corto.js`, `js/corto.em.js` | MIT | [Corto](https://github.com/cnr-isti-vclab/corto) |
| `js/spidergl.js` | BSD-3-Clause | SpiderGL (Marco Di Benedetto, VCLab) |
| `skins/`, `stylesheet/`, `models-system/` | GPL-3.0-or-later | 3DHOP |

The combined work is distributed under GPL-3.0-or-later.

**Modification notices.** GPL-3 §5(a) requires modified files to carry a prominent notice saying
so, with a date. Every file listed under Layer 1 and Layer 2 below has a `MODIFIED from upstream
3DHOP 4.3 …` block directly under its original licence header. Keep it there when editing, and
add one to any further file you change.

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
- `js/jquery.js` has been removed from `SCRIPT_RESOURCES` in `react-3dhop`'s `src/viewer/assets.ts`.
- `3DHOP_no_tools.html` was converted to `DOMContentLoaded` as well.

**Invariant to preserve: no file in `js/` may call `jQuery(...)` or use jQuery's `$`.**
`npm run lint` in this package runs `scripts/check-no-jquery.mjs`, which fails if it finds any.
By hand:

```bash
grep -c 'jQuery(' packages/3dhop/js/*.js   # must be 0 everywhere
```

Note that `spidergl.js` contains the substrings `requests$(` and `muls$(`. These are ordinary
minified identifiers, not jQuery calls.

## Layer 2 — the "4.3.5" patch set

`presenter.js` reports `HOP_VERSION = "4.3.5"`. **This is not an upstream release.** It comes
from the build running in the `khm_3dhop_desktop` project, added there by a commit titled
"update from server", and was adopted here (2025-10-25) for parity between the two projects.
Who made these changes, and when, is not recorded; the version string suggests a VCLab
development build rather than local patches, but that is unconfirmed.

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

## Layer 3 — `restoreMeasurement()` (this repo, 2026-10)

Added `presenter.restoreMeasurement(pointA, pointB)` to `js/presenter.js`, next to
`enableMeasurementTool`/`isMeasurementToolEnabled`. It re-displays a previously completed
measurement (sets `_pointA`/`_pointB`/`measurement`/`_measurementStage = 3` and repaints) without
making the user re-pick both points — needed so `@ikaros-arch/react-3dhop`'s `measure` interactive
tool can support `captureState`/`restoreState` (e.g. for an app restoring a saved camera view
together with whatever was being measured). It's a small new method alongside existing ones, not a
change to any upstream behaviour; `_measureRefresh`'s own completion branch is unmodified and is
where `restoreMeasurement`'s body was copied from, substituting given points for a pick event.

## Layer 4 — toolbar hover/click wiring matches on `[data-hop-id]` (this repo, 2026-10)

`init.js`'s toolbar hover/mousedown/mouseup/touch handlers and `setToolbarOpacity` previously
matched `#toolbar img`, hardcoding the assumption that every toolbar icon is an `<img>`. Both
selectors now match `#toolbar [data-hop-id]` instead. `@ikaros-arch/react-3dhop`'s `ToolbarImage`
already set `data-hop-id` equal to `id` on every icon it renders, so existing `<img>`-based
toolbars are unaffected; this only widens what else can sit in that slot, enabling
`@ikaros-arch/react-3dhop`'s toolbar controls to render arbitrary icon content (e.g. an icon-font
`<i>` element) instead of only an image URL, while keeping the same hover/click/touch behaviour.

## Layer 5 — stop trackball `setup()` from mutating caller-owned clamp arrays (this repo, 2026-10)

`trackball_turntable.js`, `trackball_turntable_pan.js`, `trackball_rail.js`, and
`trackball_pantilt.js` each convert their angular clamp options (`minMaxPhi`/`minMaxTheta`, or
`minMaxAngleX`/`minMaxAngleY` for pan-tilt) from degrees to radians by assigning the caller's
array directly (`this._minMaxPhi = opt.minMaxPhi;`) and then overwriting its elements in place
(`this._minMaxPhi[0] = sglDegToRad(...)`). Upstream this is harmless because `setup()` only ever
runs once per page load. `@ikaros-arch/react-3dhop` calls `presenter.setScene()` - which
reconstructs the trackball via `setup()` - on every structural scene change (e.g. adding an
annotation spot), and passes a memoised `trackOptions` object whose clamp arrays are the same
object across those calls. The result: the first `setup()` correctly converts degrees to radians
in place, but a second `setup()` call sees already-converted radians and converts them *again*,
shrinking the clamp range by a factor of `180/π` each time (and, for phi, permanently flipping
`_limitPhi` from unconstrained to constrained, since the `-180`/`180` sentinel check no longer
matches once the array holds radians). After a few scene reloads rotation becomes clamped to a
near-zero range, which reads as "rotation barely works" with the view stuck near the trackball's
start position. Fixed by copying the array (`opt.minMaxPhi.slice()`) before converting in place,
in all four files.

## Unmodified from upstream 4.3

`js/ply.js`, `js/corto.js`, `js/corto.em.js`, `js/meco.js`, `js/helpers.js`, `js/spidergl.js`,
and everything under `stylesheet/`, `models/`, `models-system/`, and `skins/` **except** the
files listed in the next section.

## Not from upstream, but published (added skin assets)

These live alongside the upstream skin files and ship in the npm tarball. They are GPL-3.0 like
the rest of the package.

| File | Origin |
|---|---|
| `skins/dark/angle.png`, `skins/dark/angle_on.png` | Toolbar icons for the angle-measurement tool, drawn by Alexis Pantos for the BITFROST viewer (KHM, University of Oslo; `BItFROST-khm` repository, `experimental` branch, 2026). Copied unchanged. |
| `skins/icons/mouse2-left.svg`, `skins/icons/mouse2-right.svg` | Mouse-button hint glyphs used by BITFROST's angle/measurement instructions, from the same source. Copied unchanged. |
| `skins/dark/grid.svg`, `skins/dark/grid_on.svg` | Toolbar icons for the grid overlay, drawn for this package in the style of the existing `transparency.svg` / `transparency_on.svg` pair. |

## Not from upstream, and not published

`annotations/annotations.txt` is a sample annotation file that came along with the
`khm_3dhop_desktop` build; it is not part of 3DHOP. It, the upstream sample model under
`models/` (`gargo.nxz`, 7 MB) and the two `3DHOP_*.html` sample pages stay in the repository for
reference but are excluded from the npm tarball by the `files` list in `package.json`.
