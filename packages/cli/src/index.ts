import type { PackageBoundary } from "@runroot/config";

export const cliPackageBoundary = {
  name: "@runroot/cli",
  kind: "package",
  phaseOwned: 5,
  responsibility:
    "Operator CLI entry points for runs, approvals, and templates.",
  publicSurface: ["command routing", "operator commands", "CLI helpers"],
} as const satisfies PackageBoundary;
