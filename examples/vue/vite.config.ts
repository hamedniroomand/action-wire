import path from 'node:path';
import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const assets = fileURLToPath(new URL('../../assets', import.meta.url));
const packages = fileURLToPath(new URL('../../packages', import.meta.url));

export default defineConfig({
  root,
  publicDir: assets,
  plugins: [vue()],
  resolve: {
    alias: {
      'action-wire': path.join(packages, 'action-wire/dist/index.js'),
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
