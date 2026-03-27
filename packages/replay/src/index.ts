import type { PackageBoundary } from "@runroot/config";

export {
  createRunTimelineQuery,
  type RunTimelineQuery,
  type RunTimelineReader,
} from "./query";
export {
  projectRunTimeline,
  type RunTimeline,
  type RunTimelineEntry,
  type RunTimelineEntryKind,
} from "./timeline";

export const replayPackageBoundary = {
  name: "@runroot/replay",
  kind: "package",
  phaseOwned: 4,
  responsibility:
    "Replay reconstruction, timeline views, and audit-friendly run history.",
  publicSurface: ["timeline models", "replay services", "debug views"],
} as const satisfies PackageBoundary;
