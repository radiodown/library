import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    viewport: { width: 1440, height: 1000 },
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187',
    // 카카오 API는 테스트에서 가로채므로 키는 아무 값이나 있으면 됩니다.
    env: { VITE_KAKAO_REST_API_KEY: process.env.VITE_KAKAO_REST_API_KEY || 'test-key' },
    reuseExistingServer: !process.env.CI,
  },
})
