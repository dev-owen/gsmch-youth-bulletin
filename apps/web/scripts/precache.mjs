import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../dist/', import.meta.url);
async function files(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await files(path, `${prefix}${entry.name}/`));
    else if (!['sw.js', 'precache.js', '_redirects', '.assetsignore'].includes(entry.name)) results.push(`/${prefix}${entry.name}`);
  }
  return results;
}
const list = await files(root.pathname);
await writeFile(new URL('../dist/precache.js', import.meta.url), `self.__PRECACHE = ${JSON.stringify(['/', ...list])};\n`);
