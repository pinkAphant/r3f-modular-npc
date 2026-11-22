import { defineConfig } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '4173';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const USE_PREVIEW = process.env.E2E_PREVIEW === '1';
const USE_GPU = process.env.PW_USE_GPU === '1';

const webglArgs = USE_GPU
  ? ['--enable-webgl', '--ignore-gpu-blocklist']
  : [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    ];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome-webgl',
      use: {
        channel: 'chrome',
        headless: true,
        launchOptions: { args: webglArgs },
      },
    },
  ],
  webServer: {
    command: USE_PREVIEW
      ? `npm run build && npx vite preview --port ${PORT} --host 127.0.0.1 --strictPort`
      : `npx vite --port ${PORT} --host 127.0.0.1 --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
