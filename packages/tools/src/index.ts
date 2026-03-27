import type { PackageBoundary } from "@runroot/config";

export const toolsPackageBoundary = {
  name: "@runroot/tools",
  kind: "package",
  phaseOwned: 3,
  responsibility:
    "Tool registry, invocation contracts, allowlists, and normalized results.",
  publicSurface: ["tool registry", "tool contract", "permission policy"],
} as const satisfies PackageBoundary;
