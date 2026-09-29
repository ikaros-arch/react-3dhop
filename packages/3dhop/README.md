# @ikaros-arch/3dhop

**Unofficial** npm packaging of the [3DHOP](https://3dhop.net/) viewer runtime, developed by the
[Visual Computing Lab, ISTI-CNR](https://vcg.isti.cnr.it/). This package is published by
[ikaros-arch](https://github.com/ikaros-arch) and is **not affiliated with or endorsed by CNR-ISTI**.
It exists because 3DHOP is not on npm; if an official package appears, this one will be deprecated
in favour of it.

It contains only the runtime assets — the JavaScript, CSS, toolbar skins and the two helper meshes
used for annotations — with **no React code**. It is the peer dependency of
[`@ikaros-arch/react-3dhop`](https://github.com/ikaros-arch/react-3dhop/tree/main/packages/react-3dhop#readme),
and is useful on its own to anyone who wants a jQuery-free 3DHOP served from a package manager.

```bash
npm install @ikaros-arch/3dhop
```

## What is in the box

| Path | Contents |
| --- | --- |
| `js/` | `presenter.js`, `nexus.js`, `spidergl.js`, `ply.js`, the five trackballs, `init.js`, … |
| `stylesheet/` | `3dhop.css`, `3dhop_panels.css` |
| `skins/` | Toolbar icons (dark / light / transparent variants) and background images |
| `models-system/` | `spot-1.ply` and `cube.ply`, the meshes 3DHOP uses for hotspots |
| `LICENSE.txt` | GPL-3.0 |
| `PROVENANCE.md` | Exactly how these files differ from upstream 3DHOP 4.3 |

The upstream sample model (`gargo.nxz`, 7 MB) and the two sample HTML pages are **not** shipped.

## How this differs from upstream

This is upstream 3DHOP 4.3 with two layers on top, both recorded in detail in
[`PROVENANCE.md`](./PROVENANCE.md):

1. **A jQuery-free `init.js`**, written in October 2025 by Federico Ponchio (ISTI-CNR). jQuery is
   not vendored and not loaded, which is what makes 3DHOP usable inside React and similar
   frameworks that own the DOM.
2. **The "4.3.5" patch set** to `presenter.js`, `nexus.js` and the trackballs — not an upstream
   release; adopted from the build used by the `khm_3dhop_desktop` project.

Every modified file carries a notice below its original licence header saying so.

## Using it

3DHOP is not a module: its scripts define globals (`Presenter`, `Nexus`, `SpiderGL`, …) and expect
to be loaded with `<script>` tags, in order, alongside the CSS. Copy or serve the package
directory from a URL your page can reach, then load:

```html
<link rel="stylesheet" href="/3dhop/stylesheet/3dhop.css">
<script src="/3dhop/js/spidergl.js"></script>
<script src="/3dhop/js/presenter.js"></script>
<script src="/3dhop/js/nexus.js"></script>
<script src="/3dhop/js/ply.js"></script>
<script src="/3dhop/js/trackball_turntable.js"></script>
<script src="/3dhop/js/trackball_turntable_pan.js"></script>
<script src="/3dhop/js/trackball_pantilt.js"></script>
<script src="/3dhop/js/trackball_sphere.js"></script>
<script src="/3dhop/js/trackball_rail.js"></script>
<script src="/3dhop/js/init.js"></script>
```

`@ikaros-arch/react-3dhop` does this for you at runtime from whatever `assetBaseUrl` you give it.

## Versioning

This package has its own `0.x` version line, independent of 3DHOP's. The 3DHOP version it wraps
is stated in `PROVENANCE.md` (currently 4.3 + the 4.3.5 patch set; `presenter.js` reports
`HOP_VERSION = "4.3.5"`).

## Licence

GPL-3.0-or-later, as 3DHOP itself. Some files carry more permissive licences from their own
projects — `nexus.js`, `nexus.monitor.js`, `meco.js`, `corto.js` and `corto.em.js` are MIT;
`spidergl.js` is BSD-3-Clause — and keep their original headers. The combined work is GPL-3.0.
See [`LICENSE.txt`](./LICENSE.txt) and the per-file table in [`PROVENANCE.md`](./PROVENANCE.md).
