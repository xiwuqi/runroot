import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL(".", import.meta.url));

export const unitTestIncludes = [
  "packages/**/src/**/*.test.ts",
  "apps/**/src/**/*.test.ts",
] as const;

export const integrationTestIncludes = [
  "packages/**/src/**/*.integration.test.ts",
  "apps/**/src/**/*.integration.test.ts",
] as const;

const workspacePackageEntries = {
  "@runroot/approvals": "packages/approvals/src/index.ts",
  "@runroot/cli": "packages/cli/src/index.ts",
  "@runroot/config": "packages/config/src/index.ts",
  "@runroot/core-runtime": "packages/core-runtime/src/index.ts",
  "@runroot/domain": "packages/domain/src/index.ts",
  "@runroot/events": "packages/events/src/index.ts",
  "@runroot/mcp": "packages/mcp/src/index.ts",
  "@runroot/observability": "packages/observability/src/index.ts",
  "@runroot/persistence": "packages/persistence/src/index.ts",
  "@runroot/replay": "packages/replay/src/index.ts",
  "@runroot/sdk": "packages/sdk/src/index.ts",
  "@runroot/templates": "packages/templates/src/index.ts",
  "@runroot/test-utils": "packages/test-utils/src/index.ts",
  "@runroot/tools": "packages/tools/src/index.ts",
} as const;

export const workspaceAliases = Object.fromEntries(
  Object.entries(workspacePackageEntries).map(([name, path]) => [
    name,
    resolve(workspaceRoot, path),
  ]),
);
