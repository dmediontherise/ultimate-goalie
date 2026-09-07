import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Ubuntu 25.10+/26.04 ships no distro package set that Playwright's
// `install-deps` recognises, and `install-deps` needs root anyway. The browser
// itself only misses four libraries (libnspr4, libnss3, libnssutil3,
// libasound2). scripts/install-browser-deps.sh unpacks those into a user-local
// prefix without root; this points the browser process at them when it exists.
// On any machine that does not need it, the directory is absent and this is a
// no-op, so the config stays portable.
const localLibDir = join(homedir(), '.local', 'pw-libs', 'usr', 'lib', 'x86_64-linux-gnu');
const browserEnv = existsSync(localLibDir)
  ? {
      LD_LIBRARY_PATH: [localLibDir, process.env.LD_LIBRARY_PATH]
        .filter(Boolean)
        .join(':'),
    }
  : undefined;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://127.0.0.1:4173/ultimate-goalie/',
    trace: 'on-first-retry',
    launchOptions: browserEnv ? { env: browserEnv } : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Tests run against the production build, not `vite dev`. On WSL the dev
  // server's on-demand transform of this project over the /mnt/c 9p filesystem
  // takes long enough that the page never reaches DOMContentLoaded inside a
  // test timeout. The build is also what actually ships, since Pages serves
  // docs/ directly.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/ultimate-goalie/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
