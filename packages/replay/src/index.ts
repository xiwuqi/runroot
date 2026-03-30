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
  archiveCrossRunAuditCatalogEntry,
  type CrossRunAuditCatalogEntry,
  type CrossRunAuditCatalogEntryApplication,
  type CrossRunAuditCatalogEntryCollection,
  type CrossRunAuditCatalogEntryView,
  type CrossRunAuditCatalogStore,
  compareCrossRunAuditCatalogEntries,
  createCrossRunAuditCatalogEntry,
  type PublishCrossRunAuditCatalogEntryInput,
} from "./catalog";
export {
  type CrossRunAuditApprovalSummary,
  type CrossRunAuditDispatchSummary,
  type CrossRunAuditQueryFilters,
  type CrossRunAuditResult,
  type CrossRunAuditResults,
  type CrossRunAuditToolSummary,
  compareCrossRunAuditResults,
  matchesCrossRunAuditFilters,
  projectCrossRunAuditResult,
} from "./cross-run";
export {
  type CrossRunAuditDrilldownFilters,
  type CrossRunAuditDrilldownIdentifiers,
  type CrossRunAuditDrilldownResult,
  type CrossRunAuditDrilldownResults,
  compareCrossRunAuditDrilldownResults,
  hasCrossRunAuditDrilldownFilters,
  matchesCrossRunAuditDrilldownFilters,
  projectCrossRunAuditDrilldownResult,
} from "./drilldown";
export {
  type CrossRunAuditDrilldownLink,
  type CrossRunAuditNavigationDrilldown,
  type CrossRunAuditNavigationFilters,
  type CrossRunAuditNavigationLink,
  type CrossRunAuditNavigationSummary,
  type CrossRunAuditNavigationView,
  projectCrossRunAuditNavigationView,
  type RunAuditViewLink,
} from "./navigation";
export {
  type CrossRunAuditCatalogQuery,
  type CrossRunAuditCatalogVisibilityQuery,
  type CrossRunAuditDrilldownQuery,
  type CrossRunAuditNavigationQuery,
  type CrossRunAuditQuery,
  type CrossRunAuditReader,
  type CrossRunAuditSavedViewQuery,
  createCrossRunAuditCatalogQuery,
  createCrossRunAuditCatalogVisibilityQuery,
  createCrossRunAuditDrilldownQuery,
  createCrossRunAuditNavigationQuery,
  createCrossRunAuditQuery,
  createCrossRunAuditSavedViewQuery,
  createRunAuditQuery,
  createRunTimelineQuery,
  type RunAuditQuery,
  type RunAuditReader,
  type RunTimelineQuery,
  type RunTimelineReader,
} from "./query";
export {
  type CreateCrossRunAuditSavedViewInput,
  type CrossRunAuditSavedView,
  type CrossRunAuditSavedViewApplication,
  type CrossRunAuditSavedViewCollection,
  type CrossRunAuditSavedViewKind,
  type CrossRunAuditSavedViewNavigationRefs,
  type CrossRunAuditSavedViewStore,
  compareCrossRunAuditSavedViews,
  createCrossRunAuditSavedView,
  hasCrossRunAuditSavedViewState,
  normalizeCrossRunAuditNavigationFilters,
} from "./saved-view";
export {
  projectRunTimeline,
  type RunTimeline,
  type RunTimelineEntry,
  type RunTimelineEntryKind,
} from "./timeline";
export {
  type CrossRunAuditCatalogVisibility,
  type CrossRunAuditCatalogVisibilityApplication,
  type CrossRunAuditCatalogVisibilityCollection,
  type CrossRunAuditCatalogVisibilityState,
  type CrossRunAuditCatalogVisibilityStore,
  type CrossRunAuditCatalogVisibilityView,
  type CrossRunAuditCatalogVisibilityViewer,
  compareCrossRunAuditCatalogVisibility,
  createCrossRunAuditCatalogVisibility,
  isCrossRunAuditCatalogVisibleToViewer,
} from "./visibility";

export const replayPackageBoundary = {
  name: "@runroot/replay",
  kind: "package",
  phaseOwned: 4,
  responsibility:
    "Replay reconstruction, timeline views, and audit-friendly run history.",
  publicSurface: ["timeline models", "replay services", "debug views"],
} as const satisfies PackageBoundary;
