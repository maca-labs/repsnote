import { defineConfig } from '@playwright/test';

const port = process.env.REPNOTE_TEST_PORT || '4397';
const baseURL = 'http://127.0.0.1:' + port;

export default defineConfig({
  testDir: './e2e',
  // Two tests exercise the system clipboard. Run them serially so each reads its own post.
  workers: 1,
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: {width:390, height:844},
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    env: {REPNOTE_PORT:port},
    url: baseURL,
  },
});
