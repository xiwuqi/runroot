import type { PackageBoundary } from "@runroot/config";

export {
  projectRunAuditView,
  type RunAuditDispatchFact,
  type RunAuditEntry,
  type RunAuditEntryCorrelation,
  type RunAuditEntryKind,
  type RunAuditEventFact,
  type RunAuditToolFact,
  type RunAuditView,
} from "./audit";
export {
  createRunAuditQuery,
  createRunTimelineQuery,
  type RunAuditQuery,
  type RunAuditReader,
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
