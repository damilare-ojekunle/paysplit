import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  css: { postcss: {} }, // don't load the Next/Tailwind PostCSS config in unit tests
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"] },
});
