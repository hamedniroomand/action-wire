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
  ],
  webServer: [
    { command: 'pnpm probe', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
    { command: 'pnpm widget:dev', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
  ],
});
