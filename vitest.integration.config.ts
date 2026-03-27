import { defineConfig } from "vitest/config";

import { integrationTestIncludes, workspaceAliases } from "./vitest.workspace";

export default defineConfig({
  resolve: {
    alias: workspaceAliases,
  },
  test: {
    environment: "node",
    include: [...integrationTestIncludes],
  },
});
