import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 55_000,
  expect: { timeout: 12_000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 800, height: 520 },
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
  },
  webServer: [
    {
      command: 'npm run preview -- --mode demo --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
    },
    {
      command: 'npm run dev:web -- --mode gallery-test --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      env: {
        VITE_DEMO_MODE: '0',
        VITE_SUPABASE_URL: 'https://gallery-fixture.supabase.invalid',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
      },
    },
  ],
});
