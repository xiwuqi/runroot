import type { PackageBoundary } from "@runroot/config";

export const eventsPackageBoundary = {
  name: "@runroot/events",
  kind: "package",
  phaseOwned: 2,
  responsibility:
    "Immutable event contracts for runs, steps, tool calls, and approvals.",
  publicSurface: ["event types", "event metadata", "event stream contracts"],
} as const satisfies PackageBoundary;
