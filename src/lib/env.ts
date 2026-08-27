import { z } from "zod";

const publicConfigSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
});

const testDefaults = {
  VITE_API_BASE_URL: "http://127.0.0.1:8010",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
};

export const publicConfig = publicConfigSchema.parse(
  import.meta.env.MODE === "test" ? { ...testDefaults, ...import.meta.env } : import.meta.env,
);
