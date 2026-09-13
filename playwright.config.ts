import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playground/compatibility',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    {
      name: 'chromium-webmcp',
      use: {
        browserName: 'chromium',
        launchOptions: { args: ['--enable-experimental-web-platform-features'] },
      },
    },
  ],
  webServer: { command: 'pnpm probe', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
