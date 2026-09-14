import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv, type Plugin } from 'vite';

import { createAssistantServer } from './server/index.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const assets = fileURLToPath(new URL('../assets', import.meta.url));
const src = fileURLToPath(new URL('../packages/actionwire/src/', import.meta.url));
const DEFAULT_MODEL_PORT = 8787;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'ACTIONWIRE_');
  const port = Number.parseInt(env['ACTIONWIRE_PORT'] ?? '', 10);
  const modelPort = Number.isFinite(port) ? port : DEFAULT_MODEL_PORT;
  return {
    root,
    publicDir: assets,
    resolve: {
      alias: { actionwire: path.join(src, 'index.ts') },
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
      modelEndpoint(env, modelPort),
    ],
    server: {
      host: '127.0.0.1',
      port: 4175,
      strictPort: true,
      proxy: {
        '/api/assistant': `http://127.0.0.1:${modelPort}`,
      },
    },
  };
});

/**
 * Starts the demo model endpoint next to the dashboard so one command serves both.
 * The key stays in this Node process. Vite never sends it to the browser.
 */
function modelEndpoint(env: Record<string, string>, port: number): Plugin {
  return {
    name: 'model-endpoint',
    apply: 'serve',
    configureServer(server) {
      const endpoint = createAssistantServer(env);
      // A server started by `pnpm playground:server` already holds the port. Use it.
      endpoint.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EADDRINUSE') throw error;
        server.config.logger.info(`Model endpoint already running on port ${port}.`);
      });
      endpoint.listen(port, '127.0.0.1', () => {
        server.config.logger.info(`Model endpoint on http://127.0.0.1:${port}`);
      });
      server.httpServer?.on('close', () => {
        endpoint.close();
      });
    },
  };
}
