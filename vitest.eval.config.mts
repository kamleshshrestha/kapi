import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Evaluations call the real model (OPENROUTER_API_KEY and OPENROUTER_MODEL from
// .env.local), so they live outside `pnpm test`. Run them with `pnpm eval`.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the environment.
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 15 * 60_000,
  },
});
