import { defineConfig } from "vitest/config";

// Security rules tests: need the Firestore emulator (run `npm run test:rules` at the root).
export default defineConfig({
  test: {
    environment: "node",
    include: ["rules-tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
