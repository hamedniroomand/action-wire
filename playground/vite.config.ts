import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const packages = fileURLToPath(new URL('../packages', import.meta.url));

function src(name: string): string {
  return path.join(packages, name, 'src');
}

export default defineConfig({
  root,
  resolve: {
    alias: {
      'webmcp-agent': path.join(src('widget'), 'index.ts'),
      '@webmcp-agent/agent': path.join(src('agent'), 'index.ts'),
      '@webmcp-agent/core': path.join(src('core'), 'index.ts'),
      '@webmcp-agent/webmcp': path.join(src('webmcp'), 'index.ts'),
    },
  },
  plugins: [
    {
      name: 'workspace-tilde',
      resolveId(id, importer) {
        if (!id.startsWith('~/') || importer === undefined) return undefined;
        const match = /\/packages\/([^/]+)\//.exec(importer.replaceAll('\\', '/'));
        const name = match?.[1];
        if (name === undefined) return undefined;
        return path.join(src(name), `${id.slice(2)}.ts`);
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
