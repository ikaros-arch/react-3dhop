import { cp, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function copyAssets() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(scriptDir, '..');
  const source = resolve(projectRoot, '3dhop');
  const destination = resolve(projectRoot, 'dist', '3dhop');

  try {
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      // eslint-disable-next-line no-console
      console.warn('[copy-assets] 3dhop assets not found, skipped');
      return;
    }
    throw error;
  }
}

copyAssets().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[copy-assets] Failed to copy assets', error);
  process.exitCode = 1;
});
