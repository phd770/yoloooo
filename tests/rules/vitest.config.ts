import { defineConfig } from "vitest/config";
// Separate from the default config: these tests need the Firestore emulator
// (`npm run test:rules`), while `npm test` must stay emulator-free.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.rules.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
