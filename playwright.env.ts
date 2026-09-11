import { loadEnv } from "vite";

const PLAYWRIGHT_ENV_KEYS = [
  "E2E_EMAIL",
  "E2E_PASSWORD",
  "VITE_API_BASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

type TestEnv = Partial<Record<(typeof PLAYWRIGHT_ENV_KEYS)[number], string>>;

export function mergeTestEnv(shellEnv: TestEnv, fileEnv: TestEnv): TestEnv {
  return Object.fromEntries(
    PLAYWRIGHT_ENV_KEYS.map((key) => [key, shellEnv[key] || fileEnv[key]]),
  ) as TestEnv;
}

export function loadPlaywrightTestEnv(cwd = process.cwd()): TestEnv {
  const testEnv = mergeTestEnv(process.env, loadEnv("test", cwd, ""));

  for (const key of PLAYWRIGHT_ENV_KEYS) {
    if (testEnv[key]) process.env[key] = testEnv[key];
  }

  return testEnv;
}
