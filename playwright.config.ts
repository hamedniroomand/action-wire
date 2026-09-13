import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,
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
      testDir: './packages/widget/e2e',
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
  webServer: [
    { command: 'pnpm probe', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
    { command: 'pnpm widget:dev', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
    { command: 'pnpm playground:dev', url: 'http://127.0.0.1:4175', reuseExistingServer: false },
    { command: 'pnpm vanilla:dev', url: 'http://127.0.0.1:4176', reuseExistingServer: false },
    { command: 'pnpm react:dev', url: 'http://127.0.0.1:4177', reuseExistingServer: false },
    { command: 'pnpm vue:dev', url: 'http://127.0.0.1:4178', reuseExistingServer: false },
  ],
});
