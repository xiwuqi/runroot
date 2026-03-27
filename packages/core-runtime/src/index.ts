import type { PackageBoundary } from "@runroot/config";

export const coreRuntimePackageBoundary = {
  name: "@runroot/core-runtime",
  kind: "package",
  phaseOwned: 2,
  responsibility:
    "Framework-independent runtime orchestration and state transition execution.",
  publicSurface: ["runtime engine", "checkpoint coordination", "retry policy"],
} as const satisfies PackageBoundary;
