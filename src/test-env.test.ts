import { describe, expect, it } from "vitest";

import { mergeTestEnv } from "../playwright.env";

describe("Playwright test environment", () => {
  it("loads values supplied by .env.test", () => {
    expect(
      mergeTestEnv(
        {},
        {
          E2E_EMAIL: "demo@example.com",
          E2E_PASSWORD: "file-password",
          VITE_SUPABASE_URL: "https://project.supabase.co",
          VITE_SUPABASE_ANON_KEY: "anon-key",
        },
      ),
    ).toMatchObject({
      E2E_EMAIL: "demo@example.com",
      E2E_PASSWORD: "file-password",
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });
  });

  it("keeps explicitly supplied shell variables ahead of file values", () => {
    expect(
      mergeTestEnv(
        { E2E_EMAIL: "ci@example.com", E2E_PASSWORD: "ci-password" },
        { E2E_EMAIL: "file@example.com", E2E_PASSWORD: "file-password" },
      ),
    ).toMatchObject({ E2E_EMAIL: "ci@example.com", E2E_PASSWORD: "ci-password" });
  });
});
