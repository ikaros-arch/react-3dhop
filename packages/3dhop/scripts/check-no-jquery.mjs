// Enforces the invariant documented in PROVENANCE.md: nothing under js/ may use jQuery.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const jsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'js');
const offenders = [];

for (const file of await readdir(jsDir)) {
  if (!file.endsWith('.js')) continue;
  const source = await readFile(join(jsDir, file), 'utf8');
  // `requests$(` / `muls$(` in spidergl.js are minified identifiers, so match the call form only.
  if (/\bjQuery\s*\(/.test(source) || /(^|[^\w$])\$\s*\(/.test(source)) {
    offenders.push(file);
  }
}

if (offenders.length > 0) {
  console.error(`[check-no-jquery] jQuery usage found in: ${offenders.join(', ')}`);
  process.exit(1);
}
console.log('[check-no-jquery] OK');
