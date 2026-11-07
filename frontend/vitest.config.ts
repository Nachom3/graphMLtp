import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./app/tests/test-setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    testTimeout: 5000,
  },
});
