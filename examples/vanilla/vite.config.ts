import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const packages = fileURLToPath(new URL('../../packages', import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: {
      'webmcp-agent': path.join(packages, 'widget/dist/index.js'),
      '@webmcp-agent/agent': path.join(packages, 'agent/dist/index.js'),
      '@webmcp-agent/core': path.join(packages, 'core/dist/index.js'),
      '@webmcp-agent/webmcp': path.join(packages, 'webmcp/dist/index.js'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4176,
    strictPort: true,
    proxy: {
      '/api/assistant': 'http://127.0.0.1:8787',
    },
  },
});
