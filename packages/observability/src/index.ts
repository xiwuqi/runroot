import type { PackageBoundary } from "@runroot/config";

export const observabilityPackageBoundary = {
  name: "@runroot/observability",
  kind: "package",
  phaseOwned: 6,
  responsibility: "Logging, tracing, and telemetry adapter contracts.",
  publicSurface: ["logger adapters", "trace hooks", "telemetry contracts"],
} as const satisfies PackageBoundary;
