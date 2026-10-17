import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next sets tsconfig "jsx": "preserve"; tests need a real transform.
  esbuild: { jsx: "automatic" },
  test: {
    // jsdom covers both the pure-logic tests and the React component tests.
    environment: "jsdom",
    globals: true,
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
  },
});
