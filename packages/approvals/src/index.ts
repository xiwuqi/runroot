import type { PackageBoundary } from "@runroot/config";

export const approvalsPackageBoundary = {
  name: "@runroot/approvals",
  kind: "package",
  phaseOwned: 4,
  responsibility: "Approval requests, decisions, and resumable operator gates.",
  publicSurface: ["approval models", "decision handling", "resume contracts"],
} as const satisfies PackageBoundary;
