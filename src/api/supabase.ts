import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "../lib/env";

export const supabase = createClient(
  publicConfig.VITE_SUPABASE_URL,
  publicConfig.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      storage: window.sessionStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
