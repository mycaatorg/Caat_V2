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
    grep: /\(PROD-(162|207|209|222|224|225)\)/,
  }],
  // The cap runner owns this server so forced test termination cannot orphan it.
  webServer: undefined,
});
