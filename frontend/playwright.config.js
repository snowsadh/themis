import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "python ../tests/inference_fixture.py",
      url: "http://127.0.0.1:8012",
      env: { THEMIS_FIXTURE_PORT: "8012" },
      reuseExistingServer: false,
    },
    {
      command:
        "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8013",
      cwd: "..",
      url: "http://127.0.0.1:8013/health",
      env: {
        THEMIS_BASE_URL: "http://127.0.0.1:8012/v1",
        THEMIS_MODEL: "test-fixture",
        COUNSEL_BASE_URL: "http://127.0.0.1:8012/v1",
        COUNSEL_MODEL: "test-fixture",
        OPENAI_API_KEY: "",
        OPENROUTER_API_KEY: "",
      },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5175 --strictPort",
      url: "http://127.0.0.1:5175",
      env: {
        NODE_ENV: "development",
        VITE_PROXY_TARGET: "http://127.0.0.1:8013",
      },
      reuseExistingServer: false,
    },
  ],
});
