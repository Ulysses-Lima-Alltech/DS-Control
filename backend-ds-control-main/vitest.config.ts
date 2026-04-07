import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(__dirname);

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    pool: "forks",
  },
  resolve: {
    alias: {
      "@infra": path.join(root, "src/infra"),
      "@common": path.join(root, "src/common"),
      "@lib": path.join(root, "src/lib"),
      "@config": path.join(root, "src/config"),
      "@integrations": path.join(root, "src/integrations"),
      "@modules": path.join(root, "src/modules"),
      "@middleware": path.join(root, "src/middleware"),
      "@models": path.join(root, "src/models"),
      "@repositories": path.join(root, "src/repositories"),
    },
  },
});
