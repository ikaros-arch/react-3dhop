import { createReadStream, existsSync, statSync } from 'node:fs'
import { cp } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
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
export default defineConfig({
  plugins: [react(), serve3dhopAssets()]
})
