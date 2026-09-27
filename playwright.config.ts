import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,
  globalTimeout: 5 * 60_000,
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      testDir: './playground/compatibility',
      testMatch: '**/*.spec.ts',
      use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4173' },
    },
    {
      name: 'chromium-webmcp',
      testDir: './playground/compatibility',
      testMatch: '**/*.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: 'http://127.0.0.1:4173',
        launchOptions: { args: ['--enable-experimental-web-platform-features'] },
      },
    },
    {
      name: 'widget',
      testDir: './packages/actionwire/e2e',
      testMatch: '**/*.spec.ts',
      use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4174' },
    },
    {
      name: 'playground',
      testDir: './playground/e2e',
      testMatch: '**/*.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
        launchOptions: { args: ['--enable-experimental-web-platform-features'] },
      },
    },
    {
      name: 'vanilla-example',
      testDir: './examples/vanilla/e2e',
      testMatch: '**/*.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: 'http://127.0.0.1:4176',
        launchOptions: { args: ['--enable-experimental-web-platform-features'] },
      },
    },
    {
      name: 'react-example',
      testDir: './examples/react/e2e',
      testMatch: '**/*.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: 'http://127.0.0.1:4177',
        launchOptions: { args: ['--enable-experimental-web-platform-features'] },
      },
    },
    {
      name: 'vue-example',
      testDir: './examples/vue/e2e',
      testMatch: '**/*.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: 'http://127.0.0.1:4178',
        launchOptions: { args: ['--enable-experimental-web-platform-features'] },
      },
    },
    {
      name: 'svelte-example',
      testDir: './examples/svelte/e2e',
      testMatch: '**/*.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: 'http://127.0.0.1:4179',
        launchOptions: { args: ['--enable-experimental-web-platform-features'] },
      },
    },
    {
      name: 'e2e-failures',
      testDir: './tests/e2e',
      testMatch: 'failures.spec.ts',
      use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:4174' },
    },
    {
      name: 'e2e-frameworks',
      testDir: './tests/e2e',
      testMatch: 'frameworks.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: 'http://127.0.0.1:4174',
        launchOptions: { args: ['--enable-experimental-web-platform-features'] },
      },
    },
    {
      name: 'e2e-native',
      testDir: './tests/e2e',
      testMatch: 'native-webmcp.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: 'http://127.0.0.1:4175',
        launchOptions: { args: ['--enable-experimental-web-platform-features'] },
      },
    },
  ],
  // pnpm runs scripts in a new process group. Playwright cannot stop that group, so call vite directly.
  webServer: [
    {
      command:
        'vite playground/compatibility --config vite.config.ts --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
    {
      command:
        'vite packages/actionwire/e2e --config vite.config.ts --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
    },
    {
      command: 'vite --config playground/vite.config.ts',
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: false,
    },
    {
      command: 'vite --config examples/vanilla/vite.config.ts',
      url: 'http://127.0.0.1:4176',
      reuseExistingServer: false,
    },
    {
      command: 'vite --config examples/react/vite.config.ts',
      url: 'http://127.0.0.1:4177',
      reuseExistingServer: false,
    },
    {
      command: 'vite --config examples/vue/vite.config.ts',
      url: 'http://127.0.0.1:4178',
      reuseExistingServer: false,
    },
    {
      command: 'vite --config examples/svelte/vite.config.ts',
      url: 'http://127.0.0.1:4179',
      reuseExistingServer: false,
    },
  ],
});
