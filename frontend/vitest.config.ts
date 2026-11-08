import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Replica el alias `@/*` de tsconfig.json para que los tests resuelvan
    // los mismos imports que Next.js.
    alias: { "@": root },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./app/tests/test-setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    testTimeout: 5000,
  },
});
