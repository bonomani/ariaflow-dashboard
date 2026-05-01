import { defineConfig, devices } from '@playwright/test';

// Opt-in e2e harness used to verify FE↔backend route contracts (e.g.
// the FE-28 alias migration). Tests intercept network traffic with
// page.route() — no real ariaflow-server needed.
//
// Usage:
//   npm run e2e:install  # one-time: download chromium binary
//   npm run e2e          # run tests
//
// CI doesn't gate on this yet — the standard `make verify` / `make ci`
// pipeline runs the static + unit suites only.

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8770',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'python -m ariaflow_dashboard.cli --port 8770',
    url: 'http://127.0.0.1:8770/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
