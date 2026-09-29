# react-3dhop workspace

Monorepo for the React bindings to the [3DHOP viewer](https://3dhop.net/), published to npm under
the `@ikaros-arch` scope.

| Package | npm | Description |
| --- | --- | --- |
| [`packages/3dhop`](packages/3dhop) | `@ikaros-arch/3dhop` | The 3DHOP runtime (JS, CSS, skins) in a jQuery-free build. Runtime assets only; unofficial packaging of CNR-ISTI's 3DHOP. |
| [`packages/react-3dhop`](packages/react-3dhop) | `@ikaros-arch/react-3dhop` | Core React component wrapper around 3DHOP, with toolbar, annotations, and navigation widgets. |
| [`packages/react-3dhop-iiif`](packages/react-3dhop-iiif) | `@ikaros-arch/react-3dhop-iiif` | Loads IIIF Presentation 4.0 / IIIF 3D manifests and drives the core viewer. |
| [`examples/react-3dhop-demo`](examples/react-3dhop-demo) | — | Vite demo application exercising all three. |

## Getting started

```bash
npm install          # installs every workspace
npm run build        # builds both libraries
npm test             # runs the unit tests
npm run dev          # starts the demo app
```

The packages are linked through npm workspaces, so changes in `packages/react-3dhop` are picked
up by `packages/react-3dhop-iiif` and the demo without publishing.

The same thing in a container, if you would rather not depend on the host toolchain:

```bash
docker compose up dev                            # demo on http://localhost:8085/
docker compose --profile verify run --rm verify  # lint, test, and every build, once
```

The demo has two views: the core viewer at `/`, and the IIIF viewer at `/?view=iiif`. The latter
takes a `?manifest=` parameter pointing at any manifest URL, and bundles a few in
`public/manifests/` — including one that works without network access and one that is deliberately
malformed.

## Documentation

[`docs/`](docs/README.md) covers the workspace itself and the features added in `react-3dhop` 0.2.0:

- [Workspace](docs/workspace.md) — layout, scripts, tests, and the demo.
- [Docker](docs/docker.md) — the containerised toolchain.
- [Scene configuration](docs/scene-configuration.md) — the `space`, `config`, `trackball` and
  `nexusTargetError` props.
- [IIIF 3D](docs/iiif.md) — how a manifest becomes a scene.
- [Upgrading to 0.2](docs/upgrading-to-0.2.md) — what changed, including the removal of jQuery.

Each package's README is its own API reference:
[@ikaros-arch/3dhop](packages/3dhop/README.md) ·
[@ikaros-arch/react-3dhop](packages/react-3dhop/README.md) ·
[@ikaros-arch/react-3dhop-iiif](packages/react-3dhop-iiif/README.md).

## Releasing

Versions and changelogs are managed with [Changesets](https://github.com/changesets/changesets):
run `npm run changeset` alongside any change that should be released, commit the generated file,
and the release workflow opens a "Version Packages" PR on `main`; merging it publishes to npm.
See [docs/workspace.md](docs/workspace.md#releasing).

## License

GPL-3.0-or-later, matching 3DHOP itself.
