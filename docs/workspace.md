# Workspace

The repository is an npm workspace. The published libraries live under `packages/`, and the demo
that exercises them lives under `examples/`.

```
react-3dhop/
├── package.json                    private workspace root
├── vitest.config.ts                picks up packages/*/test/**/*.test.ts
├── docs/
├── packages/
│   ├── react-3dhop/                the core viewer
│   │   ├── src/
│   │   ├── 3dhop/                  vendored 3DHOP build (see PROVENANCE.md)
│   │   └── scripts/copy-assets.mjs postbuild copy of 3dhop/ into dist/
│   └── react-3dhop-iiif/           IIIF Presentation 4.0 / IIIF 3D support
│       ├── src/
│       └── test/                   the whole test suite currently lives here
└── examples/react-3dhop-demo/      Vite application using both packages
```

`react-3dhop-iiif` depends on `react-3dhop` as a **peer** dependency, and the demo depends on both.
npm links all three through the workspace, so an edit in `packages/react-3dhop/src` is visible to
the other two without publishing — after a rebuild, since the demo consumes the built `dist/`.

## Scripts

Run from the repository root:

| Command | Effect |
| --- | --- |
| `npm install` | Installs every workspace and links them together |
| `npm run build` | Builds both libraries with tsup; copies `3dhop/` into `packages/react-3dhop/dist/` |
| `npm run lint` | `tsc --noEmit` in both libraries |
| `npm test` | Runs the Vitest suites once |
| `npm run test:watch` | Runs Vitest in watch mode |
| `npm run dev` | Starts the demo application |

The demo has its own `npm run lint` (ESLint) and `npm run build` (`tsc -b && vite build`), run from
`examples/react-3dhop-demo`.

All of this also runs in a container, which is the reproducible way to do it:
`docker compose up dev` serves the demo, `docker compose --profile verify run --rm verify` runs the
whole check suite. See [docker.md](docker.md).

Building the libraries before starting the demo matters the first time: the demo imports
`react-3dhop` and `react-3dhop-iiif` by package name, and both resolve to `dist/`.

The workspace root pins the same `vite` the demo uses (`npm:rolldown-vite`) so that only one copy
of Vite exists in the tree. Vitest declares `vite` as a peer dependency and resolves to that shared
copy; if two versions were hoisted side by side, `@vitejs/plugin-react` could resolve against the
wrong one and the demo's `tsc -b` would fail on two incompatible sets of Vite types.

## Tests

Vitest runs in the `node` environment and collects `packages/*/test/**/*.test.ts`. The suites cover
the parts of `react-3dhop-iiif` that are pure functions, which is deliberately most of the package:

| Suite | Covers |
| --- | --- |
| `parser.test.ts` | Manifest traversal, source selection, cameras, metadata, malformed input |
| `units.test.ts` | The unit conversion table |
| `transforms.test.ts` | Ordered transform composition and the model matrix |
| `camera.test.ts` | `view2track` / `track2view` round-trips |

Nothing in the suite needs a browser, a WebGL context, or 3DHOP's globals. The geometry and parsing
code takes scene framing as an argument rather than reading it off a live presenter, which is what
makes that possible — keep it that way when adding to it.

The React components are not unit-tested; they are verified through the demo.

## The demo

`examples/react-3dhop-demo` serves two views from one page:

- `/` — the core viewer, with the full toolbar, annotations, and both navigation overlays.
- `/?view=iiif` — the IIIF viewer. Pass `?manifest=<url>` to point it at any manifest; supplying
  `?manifest=` alone is enough to select the view.

Four manifests ship in `public/manifests/`:

| Manifest | Purpose |
| --- | --- |
| `local.json` | Two instances of the mesh bundled with the demo — renders with no network access |
| `astronaut.json` | Single model, remote mesh |
| `advanced.json` | Several models with transforms, positions, and saved cameras |
| `broken.json` | Every annotation malformed in a different way, to exercise the diagnostics |

`local.json` is the default, so the demo works offline.

`vite.config.ts` contains a small plugin that serves `packages/react-3dhop/3dhop` at `/3dhop/`
during development and copies it into `dist/3dhop` on build. That is the demo's stand-in for the
asset-hosting step a real consumer has to do themselves; see `assetBaseUrl` in the
[core README](../packages/react-3dhop/README.md).

## Vendored 3DHOP

`packages/react-3dhop/3dhop/` is a copy of 3DHOP, not a dependency. It is upstream 4.3 plus two
local layers: a rewrite of `init.js` against the plain DOM API, and a patch set adopted from the
build used by the `khm_3dhop_desktop` project. Both layers, and the per-file diff sizes, are
recorded in [`PROVENANCE.md`](../packages/react-3dhop/3dhop/PROVENANCE.md).

One invariant is worth repeating here, because it is the reason the rewrite exists at all: **no file
under `3dhop/js/` may use jQuery.** jQuery is not vendored and not loaded. Before bumping the
vendored build, check:

```bash
grep -c 'jQuery(' packages/react-3dhop/3dhop/js/*.js   # must be 0 everywhere
```
