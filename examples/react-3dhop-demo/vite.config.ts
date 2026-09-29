import { createReadStream, existsSync, statSync } from 'node:fs'
import { cp } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const here = fileURLToPath(new URL('.', import.meta.url))
const hopAssets = resolve(here, '../../packages/react-3dhop/3dhop')

const MIME_TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm'
}

/**
 * Serves the 3DHOP runtime assets from the workspace package at `/3dhop`.
 *
 * The published package ships them under `dist/3dhop`, but inside the workspace the demo would
 * otherwise have to reach outside its own root, which Vite blocks. Serving them from a stable
 * URL keeps `assetBaseUrl` identical in dev, preview, and production builds.
 */
function serve3dhopAssets(): Plugin {
  const prefix = '/3dhop/'

  return {
    name: 'serve-3dhop-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url || !url.startsWith(prefix)) {
          next()
          return
        }

        const relative = normalize(decodeURIComponent(url.slice(prefix.length)))
        // Reject traversal outside the asset directory.
        if (relative.startsWith('..')) {
          next()
          return
        }

        const filePath = join(hopAssets, relative)
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          next()
          return
        }

        res.setHeader('Content-Type', MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream')
        createReadStream(filePath).pipe(res)
      })
    },
    async closeBundle() {
      await cp(hopAssets, resolve(here, 'dist/3dhop'), { recursive: true })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Reads examples/react-3dhop-demo/.env (see .env.example); real env vars — e.g. those `compose.yaml`
  // sets for the Docker dev server — take priority over the file, so this also picks up the
  // container's settings. Merged into process.env so VITE_POLL, read directly below, sees it too.
  const env = loadEnv(mode, process.cwd())
  Object.assign(process.env, env)

  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',').map((host) => host.trim()).filter(Boolean)
    : undefined

  return {
    plugins: [react(), serve3dhopAssets()],
    server: {
      host: env.VITE_DEV_HOST || undefined,
      port: env.VITE_DEV_PORT ? Number(env.VITE_DEV_PORT) : undefined,
      // Vite rejects requests for any Host header it doesn't recognise, which matters when the
      // server sits behind a reverse proxy rather than being reached as localhost.
      allowedHosts,
      // Bind-mounted filesystems (Docker, WSL) do not deliver inotify events, so hot reload only
      // works there if the watcher polls. Off unless asked for; polling is wasteful natively.
      watch: process.env.VITE_POLL ? { usePolling: true, interval: 300 } : undefined
    }
  }
})
