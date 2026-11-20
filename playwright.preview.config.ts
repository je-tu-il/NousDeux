import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  workers: 2,
  use: { ...config.use, baseURL: 'http://127.0.0.1:8082' },
  webServer: {
    command: 'node scripts/serve-preview.cjs dist-test 8082',
    url: 'http://127.0.0.1:8082',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
