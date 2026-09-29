# Workspace

The repository is an npm workspace. The published libraries live under `packages/`, and the demo
that exercises them lives under `examples/`.

```
react-3dhop/
├── package.json                    private workspace root
├── vitest.config.ts                picks up packages/*/test/**/*.test.ts
├── .changeset/                     Changesets config + pending release notes
├── .github/workflows/              ci.yml (PRs) and release.yml (main)
├── docs/
├── packages/
│   ├── 3dhop/                      @ikaros-arch/3dhop — the vendored 3DHOP runtime (see PROVENANCE.md)
│   │   ├── js/ skins/ stylesheet/ models-system/
│   │   └── scripts/check-no-jquery.mjs
│   ├── react-3dhop/                @ikaros-arch/react-3dhop — the core viewer
│   │   └── src/
│   └── react-3dhop-iiif/           @ikaros-arch/react-3dhop-iiif — IIIF Presentation 4.0 / IIIF 3D support
│       ├── src/
│       └── test/                   the whole test suite currently lives here
└── examples/react-3dhop-demo/      Vite application using all three packages
```

The dependency chain is one-directional and every link is a **peer** dependency:
`react-3dhop-iiif` → `react-3dhop` → `3dhop`. The demo depends on all three. npm links them
through the workspace, so an edit in `packages/react-3dhop/src` is visible to the other two without
publishing — after a rebuild, since the demo consumes the built `dist/`.

`@ikaros-arch/3dhop` has no build step: it is the asset files as they sit in the repository. The
wrapper never imports it as a module; it loads the scripts and CSS at runtime from `assetBaseUrl`,
so the package is a peer only so that consumers get the files into `node_modules` and control the
version.

## Scripts

Run from the repository root:

| Command | Effect |
| --- | --- |
| `npm install` | Installs every workspace and links them together |
| `npm run build` | Builds both React libraries with tsup |
| `npm run lint` | `tsc --noEmit` in both React libraries; the no-jQuery check in `packages/3dhop` |
| `npm test` | Runs the Vitest suites once |
| `npm run test:watch` | Runs Vitest in watch mode |
| `npm run dev` | Starts the demo application |
| `npm run pack:dry` | Lists exactly what each of the three tarballs would contain |
| `npm run changeset` | Records a pending release note (see [Releasing](#releasing)) |

The demo has its own `npm run lint` (ESLint) and `npm run build` (`tsc -b && vite build`), run from
`examples/react-3dhop-demo`.

All of this also runs in a container, which is the reproducible way to do it:
`docker compose up dev` serves the demo, `docker compose --profile verify run --rm verify` runs the
whole check suite. See [docker.md](docker.md).

Building the libraries before starting the demo matters the first time: the demo imports
`@ikaros-arch/react-3dhop` and `@ikaros-arch/react-3dhop-iiif` by package name, and both resolve to `dist/`.

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

`vite.config.ts` contains a small plugin that serves `packages/3dhop` at `/3dhop/`
during development and copies it into `dist/3dhop` on build. That is the demo's stand-in for the
asset-hosting step a real consumer has to do themselves; see `assetBaseUrl` in the
[core README](../packages/react-3dhop/README.md).

## Vendored 3DHOP

`packages/3dhop/` is a copy of 3DHOP, not a dependency on upstream, published as
`@ikaros-arch/3dhop`. It is upstream 4.3 plus two
layers: a jQuery-free `init.js` written by Federico Ponchio (CNR-ISTI) in October 2025, and a
patch set adopted from the build used by the `khm_3dhop_desktop` project. Both layers, the
per-file diff sizes, and the licence of every file are recorded in
[`PROVENANCE.md`](../packages/3dhop/PROVENANCE.md).

One invariant is worth repeating here, because it is the reason the rewrite exists at all: **no file
under `packages/3dhop/js/` may use jQuery.** jQuery is not vendored and not loaded.
`npm run lint` enforces it (`packages/3dhop/scripts/check-no-jquery.mjs`); by hand:

```bash
grep -c 'jQuery(' packages/3dhop/js/*.js   # must be 0 everywhere
```

## Releasing

All three packages are published to npm under the `@ikaros-arch` scope with
[Changesets](https://github.com/changesets/changesets).

1. With any change that should reach npm, run `npm run changeset`, pick the affected packages and
   the bump type, write a line for the changelog, and commit the file it creates under `.changeset/`.
2. On merge to `main`, `release.yml` runs `changeset version` and opens (or updates) a
   **"Version Packages"** pull request that bumps versions, updates each package's `CHANGELOG.md`,
   and bumps the inter-package peer ranges (`updateInternalDependencies: patch`).
3. Merging that PR runs `changeset publish`, which builds (`prepack`) and publishes every package
   whose version is not yet on the registry, and tags the commit `@ikaros-arch/<name>@<version>`.

Publishing uses npm **trusted publishing** (OIDC from GitHub Actions), so no long-lived token is
stored in the repository. The workflow runs on every push to `main` (and on demand via
*Run workflow*); it is idempotent and does nothing when there is neither a pending changeset nor an
unpublished version. Publishing is **switched off** until the repository variable `NPM_PUBLISH` is
`true`, so the first-release bootstrap looks like this:

1. Repo (and org) Settings → Actions → General → tick **"Allow GitHub Actions to create and approve
   pull requests"**. Without it the action pushes the `changeset-release/main` branch and then
   fails when opening the PR.
2. Let the workflow open the Version Packages PR; review and merge it. Versions and changelogs are
   now bumped on `main`, but nothing has been published.
3. Publish by hand from that commit, in dependency order:
   `npm publish --access public -w packages/3dhop`, then `-w packages/react-3dhop`, then
   `-w packages/react-3dhop-iiif` (`prepack` builds first). Requires `npm login` with 2FA.
4. On npmjs.com, each package → Settings → *Trusted Publisher* → GitHub Actions, repository
   `ikaros-arch/react-3dhop`, workflow `release.yml`. This can only be done on a package that exists.
5. Repo Settings → Secrets and variables → Actions → Variables → `NPM_PUBLISH` = `true`. From
   here on, merging a Version Packages PR publishes automatically.

`npm run pack:dry` shows what each tarball will contain; run it before the first publish and
whenever `files` changes. The `3dhop` package deliberately omits the 7 MB sample model and the
sample HTML pages.
