import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const packages = path.join(root, 'packages');

function src(name: string): string {
  return path.join(packages, name, 'src');
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@action-wire/agent': path.join(src('agent'), 'index.ts'),
      '@action-wire/core': path.join(src('core'), 'index.ts'),
      '@action-wire/webmcp': path.join(src('webmcp'), 'index.ts'),
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
});
