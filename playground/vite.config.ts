import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const assets = fileURLToPath(new URL('../assets', import.meta.url));
const src = fileURLToPath(new URL('../packages/action-wire/src/', import.meta.url));

export default defineConfig({
  root,
  publicDir: assets,
  resolve: {
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
  server: {
    host: '127.0.0.1',
    port: 4175,
    strictPort: true,
    proxy: {
      '/api/assistant': 'http://127.0.0.1:8787',
    },
  },
});
