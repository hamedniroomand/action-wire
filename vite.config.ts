import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const src = fileURLToPath(new URL('packages/action-wire/src/', import.meta.url));
const assets = fileURLToPath(new URL('assets', import.meta.url));

export default defineConfig({
  publicDir: assets,
  resolve: {
    tsconfigPaths: true,
    alias: { 'action-wire': path.join(src, 'index.ts') },
  },
  plugins: [
    {
      name: 'workspace-tilde',
      resolveId(id) {
        if (!id.startsWith('~/')) return undefined;
        const base = path.join(src, id.slice(2));
        const file = `${base}.ts`;
        return existsSync(file) ? file : path.join(base, 'index.ts');
      },
    },
  ],
});
