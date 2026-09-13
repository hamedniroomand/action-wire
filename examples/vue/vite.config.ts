import path from 'node:path';
import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const packages = fileURLToPath(new URL('../../packages', import.meta.url));

export default defineConfig({
  root,
  plugins: [vue()],
  resolve: {
    alias: {
      'action-wire': path.join(packages, 'widget/dist/index.js'),
      '@action-wire/agent': path.join(packages, 'agent/dist/index.js'),
      '@action-wire/core': path.join(packages, 'core/dist/index.js'),
      '@action-wire/webmcp': path.join(packages, 'webmcp/dist/index.js'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4178,
    strictPort: true,
    proxy: {
      '/api/assistant': 'http://127.0.0.1:8787',
    },
  },
});
