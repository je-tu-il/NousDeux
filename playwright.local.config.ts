import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({
  ...config,
  testDir: './tests/e2e-local',
  outputDir: '.expo/local-test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: '.expo/local-playwright-report' }]],
  workers: 1,
  use: { ...config.use, baseURL: 'http://127.0.0.1:8083' },
  webServer: {
    command: 'node scripts/serve-preview.cjs .expo/emulator-web 8083',
    url: 'http://127.0.0.1:8083', reuseExistingServer: true,
  },
});
