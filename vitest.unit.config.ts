import { defineConfig } from "vitest/config";

import { unitTestIncludes, workspaceAliases } from "./vitest.workspace";

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    environment: "node",
    include: [...unitTestIncludes],
    exclude: ["**/*.integration.test.ts"],
  },
});
