import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx'],
    environment: 'node'
  },
  resolve: {
    alias: {
      // Mirrors packages/react-3dhop-iiif/tsconfig.json's `paths` override: tests that import
      // @ikaros-arch/react-3dhop (e.g. to render a real <Toolbar> for an integration test) resolve
      // against its source, not dist/, so running tests never requires building it first.
      '@ikaros-arch/react-3dhop': fileURLToPath(new URL('./packages/react-3dhop/src/index.ts', import.meta.url))
    }
  }
});
