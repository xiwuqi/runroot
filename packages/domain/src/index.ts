import type { PackageBoundary } from "@runroot/config";

export const domainPackageBoundary = {
  name: "@runroot/domain",
  kind: "package",
  phaseOwned: 2,
  responsibility:
    "Shared domain language for runs, steps, tool calls, approvals, and events.",
  publicSurface: ["domain models", "value objects", "domain errors"],
} as const satisfies PackageBoundary;
