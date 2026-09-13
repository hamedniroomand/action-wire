import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const packages = fileURLToPath(new URL('../../packages', import.meta.url));

export default defineConfig({
  root,
  plugins: [svelte()],
  resolve: {
    alias: {
      'action-wire': path.join(packages, 'action-wire/dist/index.js'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4179,
    strictPort: true,
    proxy: {
      '/api/assistant': 'http://127.0.0.1:8787',
    },
  },
});
