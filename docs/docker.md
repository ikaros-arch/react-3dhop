# Running in Docker

[`compose.yaml`](../compose.yaml) provides a Linux toolchain for the workspace, so builds, tests and
the dev server behave the same regardless of the host. It needs no Dockerfile — it runs
`node:24-bookworm-slim` directly.

## Commands

```bash
docker compose up dev                            # install, build, serve the demo on :8085
docker compose --profile verify run --rm verify  # lint, test, build everything, once
docker compose run --rm dev bash                 # a shell in the same environment
docker compose down -v                           # stop and discard the installed dependencies
```

`docker compose up dev` installs, builds both libraries, then starts Vite bound to `0.0.0.0`. The
demo is at **http://localhost:8085/** from the host browser; see
[workspace.md](workspace.md#the-demo) for the two views and the manifests they load. `Ctrl-C` stops
it.

`verify` runs what CI would: `lint`, `test`, both library builds, and the demo's production build
and ESLint pass. It is behind a profile so `docker compose up` never starts it by accident.

Run one service at a time. They share the dependency volumes, so two concurrent installs would
race.

## Configuration

`dev`'s host, port, and Vite's `allowedHosts` come from environment variables, not hardcoded CLI
flags — copy [`.env.example`](../.env.example) to `.env` at the repository root to override any of
them (`.env` is gitignored):

```bash
cp .env.example .env
```

```
VITE_DEV_HOST=0.0.0.0        # must stay 0.0.0.0 for the published port to be reachable
VITE_DEV_PORT=8085           # used for both sides of the port mapping
VITE_ALLOWED_HOSTS=          # comma-separated, e.g. a reverse proxy's hostname
```

`compose.yaml` substitutes `VITE_DEV_PORT` into the port mapping and forwards all three into the
container's environment, where
[`vite.config.ts`](../examples/react-3dhop-demo/vite.config.ts) reads them via `loadEnv`. Running
the demo outside Docker honours the same variables through
[`examples/react-3dhop-demo/.env.example`](../examples/react-3dhop-demo/.env.example) instead.

## How it is put together

The repository is bind-mounted at `/app`, but **every `node_modules` is a named volume**:

```yaml
volumes:
  - .:/app
  - root_modules:/app/node_modules
  - core_modules:/app/packages/react-3dhop/node_modules
  - iiif_modules:/app/packages/react-3dhop-iiif/node_modules
  - demo_modules:/app/examples/react-3dhop-demo/node_modules
  - npm_cache:/root/.npm
```

This is the part that matters. Rolldown and esbuild ship platform-specific native binaries, so a
Linux install and a host install cannot share a `node_modules` — masking each one with a volume
keeps the two side by side without either corrupting the other. It also keeps several hundred
megabytes of dependencies off the host filesystem, which is worth having when the checkout sits in
a synced folder. The npm cache is a volume too, so repeat installs are fast.

Source files still cross the bind mount, so edits on the host are picked up in the container, and
build output written in the container appears on the host.

## The lockfile

Installs go through [`docker/install.sh`](../docker/install.sh), which restores
`package-lock.json` afterwards.

`npm ci` would be the natural choice and does not work here. npm resolves the optional wasm
fallback bindings (`@emnapi/core`, `@emnapi/runtime`) differently on Linux and on Windows, so a
lockfile written by one platform counts as out of sync on the other and `npm ci` refuses it.
Left alone, each platform rewrites the file and the next install on the other rewrites it back.

The rule that follows: **the host is the only place the lockfile is generated.** After changing
dependencies, run `npm install` on the host and commit the result. The container still honours the
pinned versions; it just does not get to write them down.

## Hot reload

Bind mounts do not deliver inotify events, so Vite's watcher cannot see host edits by default. The
`dev` service sets `VITE_POLL=1`, which turns on polling in
[`vite.config.ts`](../examples/react-3dhop-demo/vite.config.ts):

```ts
watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined
```

Polling costs CPU, so it stays off unless that variable is set — a native `npm run dev` is
unaffected.

## Notes

- **Ownership.** The container runs as root, so files it creates in the bind mount are root-owned.
  This is invisible on a Windows bind mount. If you move the checkout inside the WSL filesystem —
  faster, and worth doing if you work in the container a lot — you may want to `chown` build
  output afterwards.
- **Node version.** The image pins Node 24. Nothing in the workspace declares an `engines` range.
- **No browser inside.** The container serves the demo; the visual checks happen in your own
  browser against `localhost:8085`. There is no headless WebGL in this setup.
