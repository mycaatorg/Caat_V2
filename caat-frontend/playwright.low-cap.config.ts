import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  retries: 0,
  workers: 1,
  outputDir: 'test-results/low-row-cap',
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report-low-cap' }], ['list']],
  use: { ...base.use, trace: 'retain-on-failure' },
  projects: [{
    name: 'low-row-cap',
    use: { ...devices['Desktop Chrome'] },
    testMatch: /staging-journeys\.spec\.ts/,
    grep: /\(PROD-(162|207|209)\)/,
  }],
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
