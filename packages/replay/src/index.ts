import type { PackageBoundary } from "@runroot/config";

export const replayPackageBoundary = {
  name: "@runroot/replay",
  kind: "package",
  phaseOwned: 4,
  responsibility:
    "Replay reconstruction, timeline views, and audit-friendly run history.",
  publicSurface: ["timeline models", "replay services", "debug views"],
} as const satisfies PackageBoundary;
