import { defineConfig } from "vitest/config";

// Pure-logic unit tests. Modules under lib/ import the Supabase client at load
// time (createClient throws without a URL/key), so provide dummy values — the
// tested functions never make network calls.
export default defineConfig({
  test: {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
