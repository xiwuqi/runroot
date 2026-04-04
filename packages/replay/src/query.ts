import type { DispatchJob } from "@runroot/dispatch";
import type { RunId, WorkflowRun } from "@runroot/domain";
import type { RuntimeEvent } from "@runroot/events";
import type { ToolHistoryEntry } from "@runroot/tools";
import {
  type CrossRunAuditCatalogAssignmentChecklist,
  type CrossRunAuditCatalogAssignmentChecklistApplication,
  type CrossRunAuditCatalogAssignmentChecklistCollection,
  type CrossRunAuditCatalogAssignmentChecklistStore,
  type CrossRunAuditCatalogAssignmentChecklistView,
  compareCrossRunAuditCatalogAssignmentChecklists,
  createCrossRunAuditCatalogAssignmentChecklist,
  normalizeChecklistItems,
  type UpdateCrossRunAuditCatalogAssignmentChecklistInput,
} from "./assignment-checklist";
import { projectRunAuditView, type RunAuditView } from "./audit";
import {
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
import {
  type CrossRunAuditCatalogChecklistItemAcknowledgment,
  type CrossRunAuditCatalogChecklistItemAcknowledgmentApplication,
  type CrossRunAuditCatalogChecklistItemAcknowledgmentCollection,
  type CrossRunAuditCatalogChecklistItemAcknowledgmentStore,
  type CrossRunAuditCatalogChecklistItemAcknowledgmentView,
  compareCrossRunAuditCatalogChecklistItemAcknowledgment,
  createCrossRunAuditCatalogChecklistItemAcknowledgment,
  normalizeChecklistItemAcknowledgmentItems,
  type UpdateCrossRunAuditCatalogChecklistItemAcknowledgmentInput,
} from "./checklist-item-acknowledgment";
import {
  type CrossRunAuditCatalogChecklistItemAttestation,
  type CrossRunAuditCatalogChecklistItemAttestationApplication,
  type CrossRunAuditCatalogChecklistItemAttestationCollection,
  type CrossRunAuditCatalogChecklistItemAttestationStore,
  type CrossRunAuditCatalogChecklistItemAttestationView,
  compareCrossRunAuditCatalogChecklistItemAttestation,
  createCrossRunAuditCatalogChecklistItemAttestation,
  normalizeChecklistItemAttestationItems,
  type UpdateCrossRunAuditCatalogChecklistItemAttestationInput,
} from "./checklist-item-attestation";
import {
  type CrossRunAuditCatalogChecklistItemBlocker,
  type CrossRunAuditCatalogChecklistItemBlockerApplication,
  type CrossRunAuditCatalogChecklistItemBlockerCollection,
  type CrossRunAuditCatalogChecklistItemBlockerStore,
  type CrossRunAuditCatalogChecklistItemBlockerView,
  compareCrossRunAuditCatalogChecklistItemBlocker,
  createCrossRunAuditCatalogChecklistItemBlocker,
  normalizeChecklistItemBlockerItems,
  type UpdateCrossRunAuditCatalogChecklistItemBlockerInput,
} from "./checklist-item-blocker";
import {
  type CrossRunAuditCatalogChecklistItemEvidence,
  type CrossRunAuditCatalogChecklistItemEvidenceApplication,
  type CrossRunAuditCatalogChecklistItemEvidenceCollection,
  type CrossRunAuditCatalogChecklistItemEvidenceStore,
  type CrossRunAuditCatalogChecklistItemEvidenceView,
  compareCrossRunAuditCatalogChecklistItemEvidence,
  createCrossRunAuditCatalogChecklistItemEvidence,
  normalizeChecklistItemEvidenceItems,
  type UpdateCrossRunAuditCatalogChecklistItemEvidenceInput,
} from "./checklist-item-evidence";
import {
  type CrossRunAuditCatalogChecklistItemException,
  type CrossRunAuditCatalogChecklistItemExceptionApplication,
  type CrossRunAuditCatalogChecklistItemExceptionCollection,
  type CrossRunAuditCatalogChecklistItemExceptionStore,
  type CrossRunAuditCatalogChecklistItemExceptionView,
  compareCrossRunAuditCatalogChecklistItemException,
  createCrossRunAuditCatalogChecklistItemException,
  normalizeChecklistItemExceptionItems,
  type UpdateCrossRunAuditCatalogChecklistItemExceptionInput,
} from "./checklist-item-exception";
import {
  type CrossRunAuditCatalogChecklistItemProgress,
  type CrossRunAuditCatalogChecklistItemProgressApplication,
  type CrossRunAuditCatalogChecklistItemProgressCollection,
  type CrossRunAuditCatalogChecklistItemProgressStore,
  type CrossRunAuditCatalogChecklistItemProgressView,
  compareCrossRunAuditCatalogChecklistItemProgress,
  createCrossRunAuditCatalogChecklistItemProgress,
  normalizeChecklistItemProgressItems,
  type UpdateCrossRunAuditCatalogChecklistItemProgressInput,
} from "./checklist-item-progress";
import {
  type CrossRunAuditCatalogChecklistItemResolution,
  type CrossRunAuditCatalogChecklistItemResolutionApplication,
  type CrossRunAuditCatalogChecklistItemResolutionCollection,
  type CrossRunAuditCatalogChecklistItemResolutionStore,
  type CrossRunAuditCatalogChecklistItemResolutionView,
  compareCrossRunAuditCatalogChecklistItemResolution,
  createCrossRunAuditCatalogChecklistItemResolution,
  normalizeChecklistItemResolutionItems,
  type UpdateCrossRunAuditCatalogChecklistItemResolutionInput,
} from "./checklist-item-resolution";
import {
  type CrossRunAuditCatalogChecklistItemSignoff,
  type CrossRunAuditCatalogChecklistItemSignoffApplication,
  type CrossRunAuditCatalogChecklistItemSignoffCollection,
  type CrossRunAuditCatalogChecklistItemSignoffStore,
  type CrossRunAuditCatalogChecklistItemSignoffView,
  compareCrossRunAuditCatalogChecklistItemSignoff,
  createCrossRunAuditCatalogChecklistItemSignoff,
  normalizeChecklistItemSignoffItems,
  type UpdateCrossRunAuditCatalogChecklistItemSignoffInput,
} from "./checklist-item-signoff";
import {
  type CrossRunAuditCatalogChecklistItemVerification,
  type CrossRunAuditCatalogChecklistItemVerificationApplication,
  type CrossRunAuditCatalogChecklistItemVerificationCollection,
  type CrossRunAuditCatalogChecklistItemVerificationStore,
  type CrossRunAuditCatalogChecklistItemVerificationView,
  compareCrossRunAuditCatalogChecklistItemVerification,
  createCrossRunAuditCatalogChecklistItemVerification,
  normalizeChecklistItemVerificationItems,
  type UpdateCrossRunAuditCatalogChecklistItemVerificationInput,
} from "./checklist-item-verification";
import {
  type CrossRunAuditQueryFilters,
  type CrossRunAuditResults,
  compareCrossRunAuditResults,
  matchesCrossRunAuditFilters,
  projectCrossRunAuditResult,
} from "./cross-run";
import {
  type CrossRunAuditDrilldownFilters,
  type CrossRunAuditDrilldownResults,
  compareCrossRunAuditDrilldownResults,
  hasCrossRunAuditDrilldownFilters,
  projectCrossRunAuditDrilldownResult,
} from "./drilldown";
import {
  type CrossRunAuditNavigationFilters,
  type CrossRunAuditNavigationView,
  projectCrossRunAuditNavigationView,
} from "./navigation";
import {
  type CrossRunAuditCatalogReviewAssignment,
  type CrossRunAuditCatalogReviewAssignmentApplication,
  type CrossRunAuditCatalogReviewAssignmentCollection,
  type CrossRunAuditCatalogReviewAssignmentStore,
  type CrossRunAuditCatalogReviewAssignmentView,
  compareCrossRunAuditCatalogReviewAssignments,
  createCrossRunAuditCatalogReviewAssignment,
  type UpdateCrossRunAuditCatalogReviewAssignmentInput,
} from "./review-assignment";
import {
  type CrossRunAuditCatalogReviewSignal,
  type CrossRunAuditCatalogReviewSignalCollection,
  type CrossRunAuditCatalogReviewSignalStore,
  type CrossRunAuditCatalogReviewSignalView,
  compareCrossRunAuditCatalogReviewSignals,
  createCrossRunAuditCatalogReviewSignal,
  type UpdateCrossRunAuditCatalogReviewSignalInput,
} from "./review-signal";
import {
  type CrossRunAuditSavedView,
  type CrossRunAuditSavedViewApplication,
  type CrossRunAuditSavedViewCollection,
  type CrossRunAuditSavedViewStore,
  compareCrossRunAuditSavedViews,
} from "./saved-view";
import { projectRunTimeline, type RunTimeline } from "./timeline";
import {
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

export interface RunTimelineReader {
  listByRunId(runId: RunId): Promise<RuntimeEvent[]>;
}

export interface RunAuditReader extends RunTimelineReader {
  listDispatchJobsByRunId(runId: RunId): Promise<readonly DispatchJob[]>;
  listToolHistoryByRunId(runId: RunId): Promise<readonly ToolHistoryEntry[]>;
}

export interface CrossRunAuditReader extends RunAuditReader {
  listRuns(): Promise<readonly WorkflowRun[]>;
}

export interface RunTimelineQuery {
  getTimeline(runId: RunId): Promise<RunTimeline>;
}

export interface RunAuditQuery {
  getAuditView(runId: RunId): Promise<RunAuditView>;
}

export interface CrossRunAuditQuery {
  listAuditResults(
    filters?: CrossRunAuditQueryFilters,
  ): Promise<CrossRunAuditResults>;
}

export interface CrossRunAuditDrilldownQuery {
  listAuditDrilldowns(
    filters?: CrossRunAuditDrilldownFilters,
  ): Promise<CrossRunAuditDrilldownResults>;
}

export interface CrossRunAuditNavigationQuery {
  getAuditNavigation(
    filters?: Partial<CrossRunAuditNavigationFilters>,
  ): Promise<CrossRunAuditNavigationView>;
}

export interface CrossRunAuditSavedViewQuery {
  applySavedView(
    id: string,
  ): Promise<CrossRunAuditSavedViewApplication | undefined>;
  getSavedView(id: string): Promise<CrossRunAuditSavedView | undefined>;
  listSavedViews(): Promise<CrossRunAuditSavedViewCollection>;
  saveSavedView(
    savedView: CrossRunAuditSavedView,
  ): Promise<CrossRunAuditSavedView>;
}

export interface CrossRunAuditCatalogQuery {
  applyCatalogEntry(
    id: string,
  ): Promise<CrossRunAuditCatalogEntryApplication | undefined>;
  archiveCatalogEntry(
    id: string,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogEntryView | undefined>;
  getCatalogEntry(
    id: string,
  ): Promise<CrossRunAuditCatalogEntryView | undefined>;
  listCatalogEntries(): Promise<CrossRunAuditCatalogEntryCollection>;
  publishCatalogEntry(
    input: PublishCrossRunAuditCatalogEntryInput,
  ): Promise<CrossRunAuditCatalogEntryView>;
}

export interface CrossRunAuditCatalogVisibilityQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogVisibilityApplication | undefined>;
  getCatalogVisibility(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogVisibilityView | undefined>;
  listVisibleCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogVisibilityCollection>;
  setCatalogVisibilityState(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    state: CrossRunAuditCatalogVisibilityState,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogVisibilityView>;
}

export interface CrossRunAuditCatalogReviewSignalQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogVisibilityApplication | undefined>;
  clearCatalogReviewSignal(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogReviewSignalView | undefined>;
  getCatalogReviewSignal(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogReviewSignalView | undefined>;
  listReviewedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogReviewSignalCollection>;
  setCatalogReviewSignal(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogReviewSignalInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogReviewSignalView>;
}

export interface CrossRunAuditCatalogReviewAssignmentQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogReviewAssignmentApplication | undefined>;
  clearCatalogReviewAssignment(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogReviewAssignmentView | undefined>;
  getCatalogReviewAssignment(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogReviewAssignmentView | undefined>;
  listAssignedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogReviewAssignmentCollection>;
  setCatalogReviewAssignment(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogReviewAssignmentInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogReviewAssignmentView>;
}

export interface CrossRunAuditCatalogAssignmentChecklistQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogAssignmentChecklistApplication | undefined>;
  clearCatalogAssignmentChecklist(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogAssignmentChecklistView | undefined>;
  getCatalogAssignmentChecklist(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogAssignmentChecklistView | undefined>;
  listChecklistedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogAssignmentChecklistCollection>;
  setCatalogAssignmentChecklist(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogAssignmentChecklistInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogAssignmentChecklistView>;
}

export interface CrossRunAuditCatalogChecklistItemProgressQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemProgressApplication | undefined>;
  clearCatalogChecklistItemProgress(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemProgressView | undefined>;
  getCatalogChecklistItemProgress(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemProgressView | undefined>;
  listProgressedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemProgressCollection>;
  setCatalogChecklistItemProgress(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogChecklistItemProgressInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogChecklistItemProgressView>;
}

export interface CrossRunAuditCatalogChecklistItemBlockerQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemBlockerApplication | undefined>;
  clearCatalogChecklistItemBlocker(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemBlockerView | undefined>;
  getCatalogChecklistItemBlocker(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemBlockerView | undefined>;
  listBlockedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemBlockerCollection>;
  setCatalogChecklistItemBlocker(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogChecklistItemBlockerInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogChecklistItemBlockerView>;
}

export interface CrossRunAuditCatalogChecklistItemResolutionQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<
    CrossRunAuditCatalogChecklistItemResolutionApplication | undefined
  >;
  clearCatalogChecklistItemResolution(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemResolutionView | undefined>;
  getCatalogChecklistItemResolution(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemResolutionView | undefined>;
  listResolvedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemResolutionCollection>;
  setCatalogChecklistItemResolution(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogChecklistItemResolutionInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogChecklistItemResolutionView>;
}

export interface CrossRunAuditCatalogChecklistItemVerificationQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<
    CrossRunAuditCatalogChecklistItemVerificationApplication | undefined
  >;
  clearCatalogChecklistItemVerification(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemVerificationView | undefined>;
  getCatalogChecklistItemVerification(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemVerificationView | undefined>;
  listVerifiedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemVerificationCollection>;
  setCatalogChecklistItemVerification(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogChecklistItemVerificationInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogChecklistItemVerificationView>;
}

export interface CrossRunAuditCatalogChecklistItemEvidenceQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidenceApplication | undefined>;
  clearCatalogChecklistItemEvidence(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidenceView | undefined>;
  getCatalogChecklistItemEvidence(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidenceView | undefined>;
  listEvidencedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidenceCollection>;
  setCatalogChecklistItemEvidence(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogChecklistItemEvidenceInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogChecklistItemEvidenceView>;
}

export interface CrossRunAuditCatalogChecklistItemAcknowledgmentQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<
    CrossRunAuditCatalogChecklistItemAcknowledgmentApplication | undefined
  >;
  clearCatalogChecklistItemAcknowledgment(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemAcknowledgmentView | undefined>;
  getCatalogChecklistItemAcknowledgment(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemAcknowledgmentView | undefined>;
  listAcknowledgedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemAcknowledgmentCollection>;
  setCatalogChecklistItemAcknowledgment(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogChecklistItemAcknowledgmentInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogChecklistItemAcknowledgmentView>;
}

export interface CrossRunAuditCatalogChecklistItemSignoffQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemSignoffApplication | undefined>;
  clearCatalogChecklistItemSignoff(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemSignoffView | undefined>;
  getCatalogChecklistItemSignoff(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemSignoffView | undefined>;
  listSignedOffCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemSignoffCollection>;
  setCatalogChecklistItemSignoff(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogChecklistItemSignoffInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogChecklistItemSignoffView>;
}

export interface CrossRunAuditCatalogChecklistItemExceptionQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemExceptionApplication | undefined>;
  clearCatalogChecklistItemException(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemExceptionView | undefined>;
  getCatalogChecklistItemException(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemExceptionView | undefined>;
  listExceptedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemExceptionCollection>;
  setCatalogChecklistItemException(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogChecklistItemExceptionInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogChecklistItemExceptionView>;
}

export interface CrossRunAuditCatalogChecklistItemAttestationQuery {
  applyCatalogEntry(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<
    CrossRunAuditCatalogChecklistItemAttestationApplication | undefined
  >;
  clearCatalogChecklistItemAttestation(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestationView | undefined>;
  getCatalogChecklistItemAttestation(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestationView | undefined>;
  listAttestedCatalogEntries(
    viewer: CrossRunAuditCatalogVisibilityViewer,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestationCollection>;
  setCatalogChecklistItemAttestation(
    id: string,
    viewer: CrossRunAuditCatalogVisibilityViewer,
    input: UpdateCrossRunAuditCatalogChecklistItemAttestationInput,
    timestamp: string,
  ): Promise<CrossRunAuditCatalogChecklistItemAttestationView>;
}

export function createRunTimelineQuery(
  reader: RunTimelineReader,
): RunTimelineQuery {
  return {
    async getTimeline(runId) {
      const events = await reader.listByRunId(runId);

      return projectRunTimeline(runId, events);
    },
  };
}

export function createRunAuditQuery(reader: RunAuditReader): RunAuditQuery {
  return {
    async getAuditView(runId) {
      const [dispatchJobs, events, toolHistory] = await Promise.all([
        reader.listDispatchJobsByRunId(runId),
        reader.listByRunId(runId),
        reader.listToolHistoryByRunId(runId),
      ]);

      return projectRunAuditView(runId, {
        dispatchJobs,
        events,
        toolHistory,
      });
    },
  };
}

export function createCrossRunAuditQuery(
  reader: CrossRunAuditReader,
): CrossRunAuditQuery {
  const auditQuery = createRunAuditQuery(reader);

  return {
    async listAuditResults(filters = {}) {
      const runs = (await reader.listRuns())
        .filter((run) => {
          if (
            filters.definitionId &&
            run.definitionId !== filters.definitionId
          ) {
            return false;
          }

          if (filters.runStatus && run.status !== filters.runStatus) {
            return false;
          }

          return true;
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const results = await Promise.all(
        runs.map(async (run) =>
          projectCrossRunAuditResult(
            run,
            await auditQuery.getAuditView(run.id),
          ),
        ),
      );
      const filteredResults = results
        .filter((result) => matchesCrossRunAuditFilters(result, filters))
        .sort(compareCrossRunAuditResults);

      return {
        filters,
        results: filteredResults,
        totalCount: filteredResults.length,
      };
    },
  };
}

export function createCrossRunAuditDrilldownQuery(
  reader: CrossRunAuditReader,
): CrossRunAuditDrilldownQuery {
  const auditQuery = createRunAuditQuery(reader);

  return {
    async listAuditDrilldowns(filters = {}) {
      if (!hasCrossRunAuditDrilldownFilters(filters)) {
        return {
          filters,
          isConstrained: false,
          results: [],
          totalCount: 0,
          totalMatchedEntryCount: 0,
        };
      }

      const runs = (await reader.listRuns())
        .filter((run) => (filters.runId ? run.id === filters.runId : true))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const results = (
        await Promise.all(
          runs.map(async (run) =>
            projectCrossRunAuditDrilldownResult(
              run,
              await auditQuery.getAuditView(run.id),
              filters,
            ),
          ),
        )
      )
        .filter(
          (result): result is NonNullable<typeof result> =>
            result !== undefined,
        )
        .sort(compareCrossRunAuditDrilldownResults);

      return {
        filters,
        isConstrained: true,
        results,
        totalCount: results.length,
        totalMatchedEntryCount: results.reduce(
          (count, result) => count + result.matchedEntryCount,
          0,
        ),
      };
    },
  };
}

export function createCrossRunAuditNavigationQuery(
  reader: CrossRunAuditReader,
): CrossRunAuditNavigationQuery {
  const crossRunAudit = createCrossRunAuditQuery(reader);
  const crossRunAuditDrilldowns = createCrossRunAuditDrilldownQuery(reader);

  return {
    async getAuditNavigation(filters = {}) {
      const summaryFilters = filters.summary ?? {};
      const drilldownFilters = filters.drilldown ?? {};
      const [summaries, drilldowns] = await Promise.all([
        crossRunAudit.listAuditResults(summaryFilters),
        crossRunAuditDrilldowns.listAuditDrilldowns(drilldownFilters),
      ]);

      return projectCrossRunAuditNavigationView(summaries, drilldowns);
    },
  };
}

export function createCrossRunAuditSavedViewQuery(
  store: CrossRunAuditSavedViewStore,
  navigation: CrossRunAuditNavigationQuery,
): CrossRunAuditSavedViewQuery {
  return {
    async applySavedView(id) {
      const savedView = await store.getSavedView(id);

      if (!savedView) {
        return undefined;
      }

      return {
        navigation: await navigation.getAuditNavigation(savedView.navigation),
        savedView,
      };
    },

    async getSavedView(id) {
      return store.getSavedView(id);
    },

    async listSavedViews() {
      const items = [...(await store.listSavedViews())].sort(
        compareCrossRunAuditSavedViews,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async saveSavedView(savedView) {
      return store.saveSavedView(savedView);
    },
  };
}

export function createCrossRunAuditCatalogQuery(
  store: CrossRunAuditCatalogStore,
  savedViews: CrossRunAuditSavedViewQuery,
): CrossRunAuditCatalogQuery {
  return {
    async applyCatalogEntry(id) {
      const catalogEntry = await resolveCatalogEntryView(store, savedViews, id);

      if (!catalogEntry || catalogEntry.entry.archivedAt) {
        return undefined;
      }

      const application = await savedViews.applySavedView(
        catalogEntry.entry.savedViewId,
      );

      if (!application) {
        return undefined;
      }

      return {
        application,
        catalogEntry,
      };
    },

    async archiveCatalogEntry(id, timestamp) {
      const entry = await store.getCatalogEntry(id);

      if (!entry) {
        return undefined;
      }

      const archivedEntry = archiveCrossRunAuditCatalogEntry(entry, timestamp);
      await store.saveCatalogEntry(archivedEntry);

      return resolveCatalogEntryView(store, savedViews, id);
    },

    async getCatalogEntry(id) {
      return resolveCatalogEntryView(store, savedViews, id);
    },

    async listCatalogEntries() {
      const entries = [...(await store.listCatalogEntries())]
        .filter((entry) => !entry.archivedAt)
        .sort(compareCrossRunAuditCatalogEntries);
      const items = (
        await Promise.all(
          entries.map(async (entry) =>
            resolveCatalogEntryFromValue(savedViews, entry),
          ),
        )
      ).filter(
        (catalogEntry): catalogEntry is CrossRunAuditCatalogEntryView =>
          catalogEntry !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async publishCatalogEntry(input) {
      const savedView = await savedViews.getSavedView(input.savedViewId);

      if (!savedView) {
        throw new Error(`Saved view "${input.savedViewId}" was not found.`);
      }

      const entry = createCrossRunAuditCatalogEntry({
        ...(input.description ? { description: input.description } : {}),
        id: input.id,
        ...(input.name ? { name: input.name } : {}),
        savedView,
        timestamp: input.timestamp,
      });

      await store.saveCatalogEntry(entry);

      return {
        entry,
        savedView,
      };
    },
  };
}

export function createCrossRunAuditCatalogVisibilityQuery(
  store: CrossRunAuditCatalogVisibilityStore,
  catalog: CrossRunAuditCatalogQuery,
): CrossRunAuditCatalogVisibilityQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const visibility = await resolveCatalogVisibilityView(store, catalog, id);

      if (
        !visibility ||
        !isCrossRunAuditCatalogVisibleToViewer(visibility.visibility, viewer)
      ) {
        return undefined;
      }

      const application = await catalog.applyCatalogEntry(id);

      if (!application) {
        return undefined;
      }

      return {
        application,
        visibility,
      };
    },

    async getCatalogVisibility(id, viewer) {
      const visibility = await resolveCatalogVisibilityView(store, catalog, id);

      if (
        !visibility ||
        !isCrossRunAuditCatalogVisibleToViewer(visibility.visibility, viewer)
      ) {
        return undefined;
      }

      return visibility;
    },

    async listVisibleCatalogEntries(viewer) {
      const visibilities = [...(await store.listCatalogVisibility())].sort(
        compareCrossRunAuditCatalogVisibility,
      );
      const items = (
        await Promise.all(
          visibilities.map(async (visibility) =>
            resolveCatalogVisibilityFromValue(catalog, visibility),
          ),
        )
      ).filter(
        (visibility): visibility is CrossRunAuditCatalogVisibilityView =>
          visibility !== undefined &&
          isCrossRunAuditCatalogVisibleToViewer(visibility.visibility, viewer),
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogVisibilityState(id, viewer, state, timestamp) {
      const catalogEntry = await catalog.getCatalogEntry(id);

      if (!catalogEntry || catalogEntry.entry.archivedAt) {
        throw new Error(`Catalog entry "${id}" was not found.`);
      }

      const existingVisibility = await store.getCatalogVisibility(id);

      if (
        existingVisibility &&
        existingVisibility.ownerId !== viewer.operatorId
      ) {
        throw new Error(
          `Catalog visibility for "${id}" can only be updated by owner "${existingVisibility.ownerId}".`,
        );
      }

      const visibility = existingVisibility
        ? {
            ...existingVisibility,
            ...(state === "shared" ? { scopeId: viewer.scopeId } : {}),
            state,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogVisibility({
            catalogEntryId: id,
            ownerId: viewer.operatorId,
            scopeId: viewer.scopeId,
            state,
            timestamp,
          });

      await store.saveCatalogVisibility(visibility);

      return {
        catalogEntry,
        visibility,
      };
    },
  };
}

export function createCrossRunAuditCatalogReviewSignalQuery(
  store: CrossRunAuditCatalogReviewSignalStore,
  visibility: CrossRunAuditCatalogVisibilityQuery,
): CrossRunAuditCatalogReviewSignalQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const review = await resolveCatalogReviewSignalView(
        store,
        visibility,
        id,
        viewer,
      );

      if (!review) {
        return undefined;
      }

      const application = await visibility.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return application;
    },

    async clearCatalogReviewSignal(id, viewer) {
      const review = await resolveCatalogReviewSignalView(
        store,
        visibility,
        id,
        viewer,
      );

      if (!review) {
        return undefined;
      }

      await store.deleteCatalogReviewSignal(id);

      return review;
    },

    async getCatalogReviewSignal(id, viewer) {
      return resolveCatalogReviewSignalView(store, visibility, id, viewer);
    },

    async listReviewedCatalogEntries(viewer) {
      const reviewSignals = [...(await store.listCatalogReviewSignals())].sort(
        compareCrossRunAuditCatalogReviewSignals,
      );
      const items = (
        await Promise.all(
          reviewSignals.map(async (reviewSignal) =>
            resolveCatalogReviewSignalFromValue(
              visibility,
              reviewSignal,
              viewer,
            ),
          ),
        )
      ).filter(
        (reviewSignal): reviewSignal is CrossRunAuditCatalogReviewSignalView =>
          reviewSignal !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogReviewSignal(id, viewer, input, timestamp) {
      const catalogVisibility = await visibility.getCatalogVisibility(
        id,
        viewer,
      );

      if (!catalogVisibility) {
        throw new Error(
          `Catalog entry "${id}" is not visible to operator "${viewer.operatorId}".`,
        );
      }

      const existingReviewSignal = await store.getCatalogReviewSignal(id);
      const normalizedNote = input.note?.trim();
      const reviewSignal = existingReviewSignal
        ? {
            ...(input.note !== undefined
              ? normalizedNote
                ? { note: normalizedNote }
                : {}
              : existingReviewSignal.note
                ? { note: existingReviewSignal.note }
                : {}),
            catalogEntryId: id,
            createdAt: existingReviewSignal.createdAt,
            kind: existingReviewSignal.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            state: input.state,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogReviewSignal({
            catalogEntryId: id,
            ...(normalizedNote ? { note: normalizedNote } : {}),
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            state: input.state,
            timestamp,
          });

      await store.saveCatalogReviewSignal(reviewSignal);

      return {
        review: reviewSignal,
        visibility: catalogVisibility,
      };
    },
  };
}

export function createCrossRunAuditCatalogReviewAssignmentQuery(
  store: CrossRunAuditCatalogReviewAssignmentStore,
  reviewSignals: CrossRunAuditCatalogReviewSignalQuery,
  visibility: CrossRunAuditCatalogVisibilityQuery,
): CrossRunAuditCatalogReviewAssignmentQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const assignment = await resolveCatalogReviewAssignmentView(
        store,
        reviewSignals,
        id,
        viewer,
      );

      if (!assignment) {
        return undefined;
      }

      const application = await visibility.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return {
        application,
        assignment,
      };
    },

    async clearCatalogReviewAssignment(id, viewer) {
      const assignment = await resolveCatalogReviewAssignmentView(
        store,
        reviewSignals,
        id,
        viewer,
      );

      if (!assignment) {
        return undefined;
      }

      await store.deleteCatalogReviewAssignment(id);

      return assignment;
    },

    async getCatalogReviewAssignment(id, viewer) {
      return resolveCatalogReviewAssignmentView(
        store,
        reviewSignals,
        id,
        viewer,
      );
    },

    async listAssignedCatalogEntries(viewer) {
      const assignments = [
        ...(await store.listCatalogReviewAssignments()),
      ].sort(compareCrossRunAuditCatalogReviewAssignments);
      const items = (
        await Promise.all(
          assignments.map(async (assignment) =>
            resolveCatalogReviewAssignmentFromValue(
              reviewSignals,
              assignment,
              viewer,
            ),
          ),
        )
      ).filter(
        (assignment): assignment is CrossRunAuditCatalogReviewAssignmentView =>
          assignment !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogReviewAssignment(id, viewer, input, timestamp) {
      const review = await reviewSignals.getCatalogReviewSignal(id, viewer);

      if (!review) {
        throw new Error(
          `Catalog entry "${id}" is not reviewed and visible to operator "${viewer.operatorId}".`,
        );
      }

      const existingAssignment = await store.getCatalogReviewAssignment(id);
      const normalizedAssigneeId = input.assigneeId.trim();
      const normalizedHandoffNote = input.handoffNote?.trim();

      if (normalizedAssigneeId.length === 0) {
        throw new Error("Catalog review assignments require an assignee id.");
      }

      const assignment = existingAssignment
        ? {
            assigneeId: normalizedAssigneeId,
            assignerId: viewer.operatorId,
            catalogEntryId: id,
            createdAt: existingAssignment.createdAt,
            ...(input.handoffNote === undefined
              ? existingAssignment.handoffNote
                ? { handoffNote: existingAssignment.handoffNote }
                : {}
              : normalizedHandoffNote
                ? { handoffNote: normalizedHandoffNote }
                : {}),
            kind: existingAssignment.kind,
            scopeId: viewer.scopeId,
            state: existingAssignment.state,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogReviewAssignment({
            assigneeId: normalizedAssigneeId,
            assignerId: viewer.operatorId,
            catalogEntryId: id,
            ...(normalizedHandoffNote
              ? { handoffNote: normalizedHandoffNote }
              : {}),
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogReviewAssignment(assignment);

      return {
        assignment,
        review,
      };
    },
  };
}

export function createCrossRunAuditCatalogAssignmentChecklistQuery(
  store: CrossRunAuditCatalogAssignmentChecklistStore,
  assignments: CrossRunAuditCatalogReviewAssignmentQuery,
): CrossRunAuditCatalogAssignmentChecklistQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const checklist = await resolveCatalogAssignmentChecklistView(
        store,
        assignments,
        id,
        viewer,
      );

      if (!checklist) {
        return undefined;
      }

      const application = await assignments.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return {
        application,
        checklist,
      };
    },

    async clearCatalogAssignmentChecklist(id, viewer) {
      const checklist = await resolveCatalogAssignmentChecklistView(
        store,
        assignments,
        id,
        viewer,
      );

      if (!checklist) {
        return undefined;
      }

      await store.deleteCatalogAssignmentChecklist(id);

      return checklist;
    },

    async getCatalogAssignmentChecklist(id, viewer) {
      return resolveCatalogAssignmentChecklistView(
        store,
        assignments,
        id,
        viewer,
      );
    },

    async listChecklistedCatalogEntries(viewer) {
      const checklists = [
        ...(await store.listCatalogAssignmentChecklists()),
      ].sort(compareCrossRunAuditCatalogAssignmentChecklists);
      const items = (
        await Promise.all(
          checklists.map(async (checklist) =>
            resolveCatalogAssignmentChecklistFromValue(
              assignments,
              checklist,
              viewer,
            ),
          ),
        )
      ).filter(
        (checklist): checklist is CrossRunAuditCatalogAssignmentChecklistView =>
          checklist !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogAssignmentChecklist(id, viewer, input, timestamp) {
      const assignment = await assignments.getCatalogReviewAssignment(
        id,
        viewer,
      );

      if (!assignment) {
        throw new Error(
          `Catalog entry "${id}" is not assigned and visible to operator "${viewer.operatorId}".`,
        );
      }

      const normalizedItems = normalizeChecklistItems(input.items);
      const existingChecklist = await store.getCatalogAssignmentChecklist(id);
      const checklist = existingChecklist
        ? {
            catalogEntryId: id,
            createdAt: existingChecklist.createdAt,
            ...(normalizedItems.length > 0 ? { items: normalizedItems } : {}),
            kind: existingChecklist.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            state: input.state,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogAssignmentChecklist({
            catalogEntryId: id,
            ...(normalizedItems.length > 0 ? { items: normalizedItems } : {}),
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            state: input.state,
            timestamp,
          });

      await store.saveCatalogAssignmentChecklist(checklist);

      return {
        assignment,
        checklist,
      };
    },
  };
}

export function createCrossRunAuditCatalogChecklistItemProgressQuery(
  store: CrossRunAuditCatalogChecklistItemProgressStore,
  checklists: CrossRunAuditCatalogAssignmentChecklistQuery,
): CrossRunAuditCatalogChecklistItemProgressQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const progress = await resolveCatalogChecklistItemProgressView(
        store,
        checklists,
        id,
        viewer,
      );

      if (!progress) {
        return undefined;
      }

      const application = await checklists.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return {
        application,
        progress,
      };
    },

    async clearCatalogChecklistItemProgress(id, viewer) {
      const progress = await resolveCatalogChecklistItemProgressView(
        store,
        checklists,
        id,
        viewer,
      );

      if (!progress) {
        return undefined;
      }

      await store.deleteCatalogChecklistItemProgress(id);

      return progress;
    },

    async getCatalogChecklistItemProgress(id, viewer) {
      return resolveCatalogChecklistItemProgressView(
        store,
        checklists,
        id,
        viewer,
      );
    },

    async listProgressedCatalogEntries(viewer) {
      const progressEntries = [
        ...(await store.listCatalogChecklistItemProgress()),
      ].sort(compareCrossRunAuditCatalogChecklistItemProgress);
      const items = (
        await Promise.all(
          progressEntries.map(async (progress) =>
            resolveCatalogChecklistItemProgressFromValue(
              checklists,
              progress,
              viewer,
            ),
          ),
        )
      ).filter(
        (progress): progress is CrossRunAuditCatalogChecklistItemProgressView =>
          progress !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogChecklistItemProgress(id, viewer, input, timestamp) {
      const checklist = await checklists.getCatalogAssignmentChecklist(
        id,
        viewer,
      );

      if (!checklist) {
        throw new Error(
          `Catalog entry "${id}" is not checklisted and visible to operator "${viewer.operatorId}".`,
        );
      }

      const allowedItems = checklist.checklist.items ?? [];

      if (allowedItems.length === 0) {
        throw new Error(
          `Catalog entry "${id}" does not define assignment checklist items for checklist item progress.`,
        );
      }

      const normalizedItems = normalizeChecklistItemProgressItems(
        input.items,
        allowedItems,
      );

      if (normalizedItems.length === 0) {
        throw new Error(
          "Catalog checklist item progress requires at least one checklist item progress entry.",
        );
      }

      const existingProgress = await store.getCatalogChecklistItemProgress(id);
      const normalizedCompletionNote = input.completionNote?.trim();
      const progress = existingProgress
        ? {
            catalogEntryId: id,
            ...(input.completionNote === undefined
              ? existingProgress.completionNote
                ? { completionNote: existingProgress.completionNote }
                : {}
              : normalizedCompletionNote
                ? { completionNote: normalizedCompletionNote }
                : {}),
            createdAt: existingProgress.createdAt,
            items: normalizedItems,
            kind: existingProgress.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogChecklistItemProgress({
            catalogEntryId: id,
            ...(normalizedCompletionNote
              ? { completionNote: normalizedCompletionNote }
              : {}),
            items: normalizedItems,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogChecklistItemProgress(progress);

      return {
        checklist,
        progress,
      };
    },
  };
}

export function createCrossRunAuditCatalogChecklistItemBlockerQuery(
  store: CrossRunAuditCatalogChecklistItemBlockerStore,
  progress: CrossRunAuditCatalogChecklistItemProgressQuery,
): CrossRunAuditCatalogChecklistItemBlockerQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const blocker = await resolveCatalogChecklistItemBlockerView(
        store,
        progress,
        id,
        viewer,
      );

      if (!blocker) {
        return undefined;
      }

      const application = await progress.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return {
        application,
        blocker,
      };
    },

    async clearCatalogChecklistItemBlocker(id, viewer) {
      const blocker = await resolveCatalogChecklistItemBlockerView(
        store,
        progress,
        id,
        viewer,
      );

      if (!blocker) {
        return undefined;
      }

      await store.deleteCatalogChecklistItemBlocker(id);

      return blocker;
    },

    async getCatalogChecklistItemBlocker(id, viewer) {
      return resolveCatalogChecklistItemBlockerView(
        store,
        progress,
        id,
        viewer,
      );
    },

    async listBlockedCatalogEntries(viewer) {
      const blockers = [
        ...(await store.listCatalogChecklistItemBlockers()),
      ].sort(compareCrossRunAuditCatalogChecklistItemBlocker);
      const items = (
        await Promise.all(
          blockers.map(async (blocker) =>
            resolveCatalogChecklistItemBlockerFromValue(
              progress,
              blocker,
              viewer,
            ),
          ),
        )
      ).filter(
        (blocker): blocker is CrossRunAuditCatalogChecklistItemBlockerView =>
          blocker !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogChecklistItemBlocker(id, viewer, input, timestamp) {
      const progressView = await progress.getCatalogChecklistItemProgress(
        id,
        viewer,
      );

      if (!progressView) {
        throw new Error(
          `Catalog entry "${id}" is not progressed and visible to operator "${viewer.operatorId}".`,
        );
      }

      const allowedItems = progressView.progress.items.map((item) => item.item);
      const normalizedItems = normalizeChecklistItemBlockerItems(
        input.items,
        allowedItems,
      );

      if (normalizedItems.length === 0) {
        throw new Error(
          "Catalog checklist item blockers require at least one checklist item blocker entry.",
        );
      }

      const existingBlocker = await store.getCatalogChecklistItemBlocker(id);
      const normalizedBlockerNote = input.blockerNote?.trim();
      const blocker = existingBlocker
        ? {
            ...(input.blockerNote === undefined
              ? existingBlocker.blockerNote
                ? { blockerNote: existingBlocker.blockerNote }
                : {}
              : normalizedBlockerNote
                ? { blockerNote: normalizedBlockerNote }
                : {}),
            catalogEntryId: id,
            createdAt: existingBlocker.createdAt,
            items: normalizedItems,
            kind: existingBlocker.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogChecklistItemBlocker({
            ...(normalizedBlockerNote
              ? { blockerNote: normalizedBlockerNote }
              : {}),
            catalogEntryId: id,
            items: normalizedItems,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogChecklistItemBlocker(blocker);

      return {
        blocker,
        progress: progressView,
      };
    },
  };
}

export function createCrossRunAuditCatalogChecklistItemResolutionQuery(
  store: CrossRunAuditCatalogChecklistItemResolutionStore,
  blockers: CrossRunAuditCatalogChecklistItemBlockerQuery,
): CrossRunAuditCatalogChecklistItemResolutionQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const resolution = await resolveCatalogChecklistItemResolutionView(
        store,
        blockers,
        id,
        viewer,
      );

      if (!resolution) {
        return undefined;
      }

      const application = await blockers.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return {
        application,
        resolution,
      };
    },

    async clearCatalogChecklistItemResolution(id, viewer) {
      const resolution = await resolveCatalogChecklistItemResolutionView(
        store,
        blockers,
        id,
        viewer,
      );

      if (!resolution) {
        return undefined;
      }

      await store.deleteCatalogChecklistItemResolution(id);

      return resolution;
    },

    async getCatalogChecklistItemResolution(id, viewer) {
      return resolveCatalogChecklistItemResolutionView(
        store,
        blockers,
        id,
        viewer,
      );
    },

    async listResolvedCatalogEntries(viewer) {
      const resolutions = [
        ...(await store.listCatalogChecklistItemResolutions()),
      ].sort(compareCrossRunAuditCatalogChecklistItemResolution);
      const items = (
        await Promise.all(
          resolutions.map(async (resolution) =>
            resolveCatalogChecklistItemResolutionFromValue(
              blockers,
              resolution,
              viewer,
            ),
          ),
        )
      ).filter(
        (
          resolution,
        ): resolution is CrossRunAuditCatalogChecklistItemResolutionView =>
          resolution !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogChecklistItemResolution(id, viewer, input, timestamp) {
      const blockerView = await blockers.getCatalogChecklistItemBlocker(
        id,
        viewer,
      );

      if (!blockerView) {
        throw new Error(
          `Catalog entry "${id}" is not blocked and visible to operator "${viewer.operatorId}".`,
        );
      }

      const allowedItems = blockerView.blocker.items.map((item) => item.item);
      const normalizedItems = normalizeChecklistItemResolutionItems(
        input.items,
        allowedItems,
      );

      if (normalizedItems.length === 0) {
        throw new Error(
          "Catalog checklist item resolutions require at least one checklist item resolution entry.",
        );
      }

      const existingResolution =
        await store.getCatalogChecklistItemResolution(id);
      const normalizedResolutionNote = input.resolutionNote?.trim();
      const resolution = existingResolution
        ? {
            ...(input.resolutionNote === undefined
              ? existingResolution.resolutionNote
                ? { resolutionNote: existingResolution.resolutionNote }
                : {}
              : normalizedResolutionNote
                ? { resolutionNote: normalizedResolutionNote }
                : {}),
            catalogEntryId: id,
            createdAt: existingResolution.createdAt,
            items: normalizedItems,
            kind: existingResolution.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogChecklistItemResolution({
            ...(normalizedResolutionNote
              ? { resolutionNote: normalizedResolutionNote }
              : {}),
            catalogEntryId: id,
            items: normalizedItems,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogChecklistItemResolution(resolution);

      return {
        blocker: blockerView,
        resolution,
      };
    },
  };
}

export function createCrossRunAuditCatalogChecklistItemVerificationQuery(
  store: CrossRunAuditCatalogChecklistItemVerificationStore,
  resolutions: CrossRunAuditCatalogChecklistItemResolutionQuery,
): CrossRunAuditCatalogChecklistItemVerificationQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const verification = await resolveCatalogChecklistItemVerificationView(
        store,
        resolutions,
        id,
        viewer,
      );

      if (!verification) {
        return undefined;
      }

      const application = await resolutions.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return {
        application,
        verification,
      };
    },

    async clearCatalogChecklistItemVerification(id, viewer) {
      const verification = await resolveCatalogChecklistItemVerificationView(
        store,
        resolutions,
        id,
        viewer,
      );

      if (!verification) {
        return undefined;
      }

      await store.deleteCatalogChecklistItemVerification(id);

      return verification;
    },

    async getCatalogChecklistItemVerification(id, viewer) {
      return resolveCatalogChecklistItemVerificationView(
        store,
        resolutions,
        id,
        viewer,
      );
    },

    async listVerifiedCatalogEntries(viewer) {
      const verifications = [
        ...(await store.listCatalogChecklistItemVerifications()),
      ].sort(compareCrossRunAuditCatalogChecklistItemVerification);
      const items = (
        await Promise.all(
          verifications.map(async (verification) =>
            resolveCatalogChecklistItemVerificationFromValue(
              resolutions,
              verification,
              viewer,
            ),
          ),
        )
      ).filter(
        (
          verification,
        ): verification is CrossRunAuditCatalogChecklistItemVerificationView =>
          verification !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogChecklistItemVerification(id, viewer, input, timestamp) {
      const resolutionView =
        await resolutions.getCatalogChecklistItemResolution(id, viewer);

      if (!resolutionView) {
        throw new Error(
          `Catalog entry "${id}" is not resolved and visible to operator "${viewer.operatorId}".`,
        );
      }

      const allowedItems = resolutionView.resolution.items.map(
        (item) => item.item,
      );
      const normalizedItems = normalizeChecklistItemVerificationItems(
        input.items,
        allowedItems,
      );

      if (normalizedItems.length === 0) {
        throw new Error(
          "Catalog checklist item verifications require at least one checklist item verification entry.",
        );
      }

      const existingVerification =
        await store.getCatalogChecklistItemVerification(id);
      const normalizedVerificationNote = input.verificationNote?.trim();
      const verification = existingVerification
        ? {
            ...(input.verificationNote === undefined
              ? existingVerification.verificationNote
                ? { verificationNote: existingVerification.verificationNote }
                : {}
              : normalizedVerificationNote
                ? { verificationNote: normalizedVerificationNote }
                : {}),
            catalogEntryId: id,
            createdAt: existingVerification.createdAt,
            items: normalizedItems,
            kind: existingVerification.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogChecklistItemVerification({
            ...(normalizedVerificationNote
              ? { verificationNote: normalizedVerificationNote }
              : {}),
            catalogEntryId: id,
            items: normalizedItems,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogChecklistItemVerification(verification);

      return {
        resolution: resolutionView,
        verification,
      };
    },
  };
}

export function createCrossRunAuditCatalogChecklistItemEvidenceQuery(
  store: CrossRunAuditCatalogChecklistItemEvidenceStore,
  verifications: CrossRunAuditCatalogChecklistItemVerificationQuery,
): CrossRunAuditCatalogChecklistItemEvidenceQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const evidence = await resolveCatalogChecklistItemEvidenceView(
        store,
        verifications,
        id,
        viewer,
      );

      if (!evidence) {
        return undefined;
      }

      const application = await verifications.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return {
        application,
        evidence,
      };
    },

    async clearCatalogChecklistItemEvidence(id, viewer) {
      const evidence = await resolveCatalogChecklistItemEvidenceView(
        store,
        verifications,
        id,
        viewer,
      );

      if (!evidence) {
        return undefined;
      }

      await store.deleteCatalogChecklistItemEvidence(id);

      return evidence;
    },

    async getCatalogChecklistItemEvidence(id, viewer) {
      return resolveCatalogChecklistItemEvidenceView(
        store,
        verifications,
        id,
        viewer,
      );
    },

    async listEvidencedCatalogEntries(viewer) {
      const evidenceEntries = [
        ...(await store.listCatalogChecklistItemEvidence()),
      ].sort(compareCrossRunAuditCatalogChecklistItemEvidence);
      const items = (
        await Promise.all(
          evidenceEntries.map(async (evidence) =>
            resolveCatalogChecklistItemEvidenceFromValue(
              verifications,
              evidence,
              viewer,
            ),
          ),
        )
      ).filter(
        (evidence): evidence is CrossRunAuditCatalogChecklistItemEvidenceView =>
          evidence !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogChecklistItemEvidence(id, viewer, input, timestamp) {
      const verificationView =
        await verifications.getCatalogChecklistItemVerification(id, viewer);

      if (!verificationView) {
        throw new Error(
          `Catalog entry "${id}" is not verified and visible to operator "${viewer.operatorId}".`,
        );
      }

      const allowedItems = verificationView.verification.items.map(
        (item) => item.item,
      );
      const normalizedItems = normalizeChecklistItemEvidenceItems(
        input.items,
        allowedItems,
      );

      if (normalizedItems.length === 0) {
        throw new Error(
          "Catalog checklist item evidence requires at least one checklist item evidence entry.",
        );
      }

      const existingEvidence = await store.getCatalogChecklistItemEvidence(id);
      const normalizedEvidenceNote = input.evidenceNote?.trim();
      const evidence = existingEvidence
        ? {
            ...(input.evidenceNote === undefined
              ? existingEvidence.evidenceNote
                ? { evidenceNote: existingEvidence.evidenceNote }
                : {}
              : normalizedEvidenceNote
                ? { evidenceNote: normalizedEvidenceNote }
                : {}),
            catalogEntryId: id,
            createdAt: existingEvidence.createdAt,
            items: normalizedItems,
            kind: existingEvidence.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogChecklistItemEvidence({
            ...(normalizedEvidenceNote
              ? { evidenceNote: normalizedEvidenceNote }
              : {}),
            catalogEntryId: id,
            items: normalizedItems,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogChecklistItemEvidence(evidence);

      return {
        evidence,
        verification: verificationView,
      };
    },
  };
}

export function createCrossRunAuditCatalogChecklistItemAttestationQuery(
  store: CrossRunAuditCatalogChecklistItemAttestationStore,
  evidenceEntries: CrossRunAuditCatalogChecklistItemEvidenceQuery,
): CrossRunAuditCatalogChecklistItemAttestationQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const attestation = await resolveCatalogChecklistItemAttestationView(
        store,
        evidenceEntries,
        id,
        viewer,
      );

      if (!attestation) {
        return undefined;
      }

      const application = await evidenceEntries.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return {
        application,
        attestation,
      };
    },

    async clearCatalogChecklistItemAttestation(id, viewer) {
      const attestation = await resolveCatalogChecklistItemAttestationView(
        store,
        evidenceEntries,
        id,
        viewer,
      );

      if (!attestation) {
        return undefined;
      }

      await store.deleteCatalogChecklistItemAttestation(id);

      return attestation;
    },

    async getCatalogChecklistItemAttestation(id, viewer) {
      return resolveCatalogChecklistItemAttestationView(
        store,
        evidenceEntries,
        id,
        viewer,
      );
    },

    async listAttestedCatalogEntries(viewer) {
      const attestationEntries = [
        ...(await store.listCatalogChecklistItemAttestations()),
      ].sort(compareCrossRunAuditCatalogChecklistItemAttestation);
      const items = (
        await Promise.all(
          attestationEntries.map(async (attestation) =>
            resolveCatalogChecklistItemAttestationFromValue(
              evidenceEntries,
              attestation,
              viewer,
            ),
          ),
        )
      ).filter(
        (
          attestation,
        ): attestation is CrossRunAuditCatalogChecklistItemAttestationView =>
          attestation !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogChecklistItemAttestation(id, viewer, input, timestamp) {
      const evidence = await evidenceEntries.getCatalogChecklistItemEvidence(
        id,
        viewer,
      );

      if (!evidence) {
        throw new Error(
          `Catalog entry "${id}" is not evidenced and visible to operator "${viewer.operatorId}".`,
        );
      }

      const allowedItems = evidence.evidence.items.map((item) => item.item);
      const normalizedItems = normalizeChecklistItemAttestationItems(
        input.items,
        allowedItems,
      );

      if (normalizedItems.length === 0) {
        throw new Error(
          "Catalog checklist item attestations require at least one checklist item attestation entry.",
        );
      }

      const existingAttestation =
        await store.getCatalogChecklistItemAttestation(id);
      const normalizedAttestationNote = input.attestationNote?.trim();
      const attestation = existingAttestation
        ? {
            ...(input.attestationNote === undefined
              ? existingAttestation.attestationNote
                ? { attestationNote: existingAttestation.attestationNote }
                : {}
              : normalizedAttestationNote
                ? { attestationNote: normalizedAttestationNote }
                : {}),
            catalogEntryId: id,
            createdAt: existingAttestation.createdAt,
            items: normalizedItems,
            kind: existingAttestation.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogChecklistItemAttestation({
            ...(normalizedAttestationNote
              ? { attestationNote: normalizedAttestationNote }
              : {}),
            catalogEntryId: id,
            items: normalizedItems,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogChecklistItemAttestation(attestation);

      return {
        attestation,
        evidence,
      };
    },
  };
}

export function createCrossRunAuditCatalogChecklistItemAcknowledgmentQuery(
  store: CrossRunAuditCatalogChecklistItemAcknowledgmentStore,
  attestationEntries: CrossRunAuditCatalogChecklistItemAttestationQuery,
): CrossRunAuditCatalogChecklistItemAcknowledgmentQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const acknowledgment =
        await resolveCatalogChecklistItemAcknowledgmentView(
          store,
          attestationEntries,
          id,
          viewer,
        );

      if (!acknowledgment) {
        return undefined;
      }

      const application = await attestationEntries.applyCatalogEntry(
        id,
        viewer,
      );

      if (!application) {
        return undefined;
      }

      return {
        acknowledgment,
        application,
      };
    },

    async clearCatalogChecklistItemAcknowledgment(id, viewer) {
      const acknowledgment =
        await resolveCatalogChecklistItemAcknowledgmentView(
          store,
          attestationEntries,
          id,
          viewer,
        );

      if (!acknowledgment) {
        return undefined;
      }

      await store.deleteCatalogChecklistItemAcknowledgment(id);

      return acknowledgment;
    },

    async getCatalogChecklistItemAcknowledgment(id, viewer) {
      return resolveCatalogChecklistItemAcknowledgmentView(
        store,
        attestationEntries,
        id,
        viewer,
      );
    },

    async listAcknowledgedCatalogEntries(viewer) {
      const acknowledgmentEntries = [
        ...(await store.listCatalogChecklistItemAcknowledgments()),
      ].sort(compareCrossRunAuditCatalogChecklistItemAcknowledgment);
      const items = (
        await Promise.all(
          acknowledgmentEntries.map(async (acknowledgment) =>
            resolveCatalogChecklistItemAcknowledgmentFromValue(
              attestationEntries,
              acknowledgment,
              viewer,
            ),
          ),
        )
      ).filter(
        (
          acknowledgment,
        ): acknowledgment is CrossRunAuditCatalogChecklistItemAcknowledgmentView =>
          acknowledgment !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogChecklistItemAcknowledgment(id, viewer, input, timestamp) {
      const attestation =
        await attestationEntries.getCatalogChecklistItemAttestation(id, viewer);

      if (!attestation) {
        throw new Error(
          `Catalog entry "${id}" is not attested and visible to operator "${viewer.operatorId}".`,
        );
      }

      const allowedItems = attestation.attestation.items.map(
        (item) => item.item,
      );
      const normalizedItems = normalizeChecklistItemAcknowledgmentItems(
        input.items,
        allowedItems,
      );

      if (normalizedItems.length === 0) {
        throw new Error(
          "Catalog checklist item acknowledgments require at least one checklist item acknowledgment entry.",
        );
      }

      const existingAcknowledgment =
        await store.getCatalogChecklistItemAcknowledgment(id);
      const normalizedAcknowledgmentNote = input.acknowledgmentNote?.trim();
      const acknowledgment = existingAcknowledgment
        ? {
            ...(input.acknowledgmentNote === undefined
              ? existingAcknowledgment.acknowledgmentNote
                ? {
                    acknowledgmentNote:
                      existingAcknowledgment.acknowledgmentNote,
                  }
                : {}
              : normalizedAcknowledgmentNote
                ? { acknowledgmentNote: normalizedAcknowledgmentNote }
                : {}),
            catalogEntryId: id,
            createdAt: existingAcknowledgment.createdAt,
            items: normalizedItems,
            kind: existingAcknowledgment.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogChecklistItemAcknowledgment({
            ...(normalizedAcknowledgmentNote
              ? { acknowledgmentNote: normalizedAcknowledgmentNote }
              : {}),
            catalogEntryId: id,
            items: normalizedItems,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogChecklistItemAcknowledgment(acknowledgment);

      return {
        acknowledgment,
        attestation,
      };
    },
  };
}

export function createCrossRunAuditCatalogChecklistItemSignoffQuery(
  store: CrossRunAuditCatalogChecklistItemSignoffStore,
  acknowledgmentEntries: CrossRunAuditCatalogChecklistItemAcknowledgmentQuery,
): CrossRunAuditCatalogChecklistItemSignoffQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const signoff = await resolveCatalogChecklistItemSignoffView(
        store,
        acknowledgmentEntries,
        id,
        viewer,
      );

      if (!signoff) {
        return undefined;
      }

      const application = await acknowledgmentEntries.applyCatalogEntry(
        id,
        viewer,
      );

      if (!application) {
        return undefined;
      }

      return {
        application,
        signoff,
      };
    },

    async clearCatalogChecklistItemSignoff(id, viewer) {
      const signoff = await resolveCatalogChecklistItemSignoffView(
        store,
        acknowledgmentEntries,
        id,
        viewer,
      );

      if (!signoff) {
        return undefined;
      }

      await store.deleteCatalogChecklistItemSignoff(id);

      return signoff;
    },

    async getCatalogChecklistItemSignoff(id, viewer) {
      return resolveCatalogChecklistItemSignoffView(
        store,
        acknowledgmentEntries,
        id,
        viewer,
      );
    },

    async listSignedOffCatalogEntries(viewer) {
      const signoffEntries = [
        ...(await store.listCatalogChecklistItemSignoffs()),
      ].sort(compareCrossRunAuditCatalogChecklistItemSignoff);
      const items = (
        await Promise.all(
          signoffEntries.map(async (signoff) =>
            resolveCatalogChecklistItemSignoffFromValue(
              acknowledgmentEntries,
              signoff,
              viewer,
            ),
          ),
        )
      ).filter(
        (signoff): signoff is CrossRunAuditCatalogChecklistItemSignoffView =>
          signoff !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogChecklistItemSignoff(id, viewer, input, timestamp) {
      const acknowledgment =
        await acknowledgmentEntries.getCatalogChecklistItemAcknowledgment(
          id,
          viewer,
        );

      if (!acknowledgment) {
        throw new Error(
          `Catalog entry "${id}" is not acknowledged and visible to operator "${viewer.operatorId}".`,
        );
      }

      const allowedItems = acknowledgment.acknowledgment.items.map(
        (item) => item.item,
      );
      const normalizedItems = normalizeChecklistItemSignoffItems(
        input.items,
        allowedItems,
      );

      if (normalizedItems.length === 0) {
        throw new Error(
          "Catalog checklist item signoffs require at least one checklist item signoff entry.",
        );
      }

      const existingSignoff = await store.getCatalogChecklistItemSignoff(id);
      const normalizedSignoffNote = input.signoffNote?.trim();
      const signoff = existingSignoff
        ? {
            ...(input.signoffNote === undefined
              ? existingSignoff.signoffNote
                ? { signoffNote: existingSignoff.signoffNote }
                : {}
              : normalizedSignoffNote
                ? { signoffNote: normalizedSignoffNote }
                : {}),
            catalogEntryId: id,
            createdAt: existingSignoff.createdAt,
            items: normalizedItems,
            kind: existingSignoff.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogChecklistItemSignoff({
            ...(normalizedSignoffNote
              ? { signoffNote: normalizedSignoffNote }
              : {}),
            catalogEntryId: id,
            items: normalizedItems,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogChecklistItemSignoff(signoff);

      return {
        acknowledgment,
        signoff,
      };
    },
  };
}

export function createCrossRunAuditCatalogChecklistItemExceptionQuery(
  store: CrossRunAuditCatalogChecklistItemExceptionStore,
  signoffEntries: CrossRunAuditCatalogChecklistItemSignoffQuery,
): CrossRunAuditCatalogChecklistItemExceptionQuery {
  return {
    async applyCatalogEntry(id, viewer) {
      const exception = await resolveCatalogChecklistItemExceptionView(
        store,
        signoffEntries,
        id,
        viewer,
      );

      if (!exception) {
        return undefined;
      }

      const application = await signoffEntries.applyCatalogEntry(id, viewer);

      if (!application) {
        return undefined;
      }

      return {
        application,
        exception,
      };
    },

    async clearCatalogChecklistItemException(id, viewer) {
      const exception = await resolveCatalogChecklistItemExceptionView(
        store,
        signoffEntries,
        id,
        viewer,
      );

      if (!exception) {
        return undefined;
      }

      await store.deleteCatalogChecklistItemException(id);

      return exception;
    },

    async getCatalogChecklistItemException(id, viewer) {
      return resolveCatalogChecklistItemExceptionView(
        store,
        signoffEntries,
        id,
        viewer,
      );
    },

    async listExceptedCatalogEntries(viewer) {
      const exceptionEntries = [
        ...(await store.listCatalogChecklistItemExceptions()),
      ].sort(compareCrossRunAuditCatalogChecklistItemException);
      const items = (
        await Promise.all(
          exceptionEntries.map(async (exception) =>
            resolveCatalogChecklistItemExceptionFromValue(
              signoffEntries,
              exception,
              viewer,
            ),
          ),
        )
      ).filter(
        (
          exception,
        ): exception is CrossRunAuditCatalogChecklistItemExceptionView =>
          exception !== undefined,
      );

      return {
        items,
        totalCount: items.length,
      };
    },

    async setCatalogChecklistItemException(id, viewer, input, timestamp) {
      const signoff = await signoffEntries.getCatalogChecklistItemSignoff(
        id,
        viewer,
      );

      if (!signoff) {
        throw new Error(
          `Catalog entry "${id}" is not signed off and visible to operator "${viewer.operatorId}".`,
        );
      }

      const allowedItems = signoff.signoff.items.map((item) => item.item);
      const normalizedItems = normalizeChecklistItemExceptionItems(
        input.items,
        allowedItems,
      );

      if (normalizedItems.length === 0) {
        throw new Error(
          "Catalog checklist item exceptions require at least one checklist item exception entry.",
        );
      }

      const existingException =
        await store.getCatalogChecklistItemException(id);
      const normalizedExceptionNote = input.exceptionNote?.trim();
      const exception = existingException
        ? {
            ...(input.exceptionNote === undefined
              ? existingException.exceptionNote
                ? { exceptionNote: existingException.exceptionNote }
                : {}
              : normalizedExceptionNote
                ? { exceptionNote: normalizedExceptionNote }
                : {}),
            catalogEntryId: id,
            createdAt: existingException.createdAt,
            items: normalizedItems,
            kind: existingException.kind,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            updatedAt: timestamp,
          }
        : createCrossRunAuditCatalogChecklistItemException({
            ...(normalizedExceptionNote
              ? { exceptionNote: normalizedExceptionNote }
              : {}),
            catalogEntryId: id,
            items: normalizedItems,
            operatorId: viewer.operatorId,
            scopeId: viewer.scopeId,
            timestamp,
          });

      await store.saveCatalogChecklistItemException(exception);

      return {
        exception,
        signoff,
      };
    },
  };
}

async function resolveCatalogEntryView(
  store: CrossRunAuditCatalogStore,
  savedViews: CrossRunAuditSavedViewQuery,
  id: string,
): Promise<CrossRunAuditCatalogEntryView | undefined> {
  const entry = await store.getCatalogEntry(id);

  return entry ? resolveCatalogEntryFromValue(savedViews, entry) : undefined;
}

async function resolveCatalogEntryFromValue(
  savedViews: CrossRunAuditSavedViewQuery,
  entry: CrossRunAuditCatalogEntry,
): Promise<CrossRunAuditCatalogEntryView | undefined> {
  const savedView = await savedViews.getSavedView(entry.savedViewId);

  if (!savedView) {
    return undefined;
  }

  return {
    entry,
    savedView,
  };
}

async function resolveCatalogVisibilityView(
  store: CrossRunAuditCatalogVisibilityStore,
  catalog: CrossRunAuditCatalogQuery,
  id: string,
): Promise<CrossRunAuditCatalogVisibilityView | undefined> {
  const visibility = await store.getCatalogVisibility(id);

  return visibility
    ? resolveCatalogVisibilityFromValue(catalog, visibility)
    : undefined;
}

async function resolveCatalogVisibilityFromValue(
  catalog: CrossRunAuditCatalogQuery,
  visibility: CrossRunAuditCatalogVisibility,
): Promise<CrossRunAuditCatalogVisibilityView | undefined> {
  const catalogEntry = await catalog.getCatalogEntry(visibility.catalogEntryId);

  if (!catalogEntry || catalogEntry.entry.archivedAt) {
    return undefined;
  }

  return {
    catalogEntry,
    visibility,
  };
}

async function resolveCatalogReviewSignalView(
  store: CrossRunAuditCatalogReviewSignalStore,
  visibilityQuery: CrossRunAuditCatalogVisibilityQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogReviewSignalView | undefined> {
  const reviewSignal = await store.getCatalogReviewSignal(id);

  return reviewSignal
    ? resolveCatalogReviewSignalFromValue(visibilityQuery, reviewSignal, viewer)
    : undefined;
}

async function resolveCatalogReviewSignalFromValue(
  visibilityQuery: CrossRunAuditCatalogVisibilityQuery,
  reviewSignal: CrossRunAuditCatalogReviewSignal,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogReviewSignalView | undefined> {
  const visibility = await visibilityQuery.getCatalogVisibility(
    reviewSignal.catalogEntryId,
    viewer,
  );

  if (!visibility) {
    return undefined;
  }

  return {
    review: reviewSignal,
    visibility,
  };
}

async function resolveCatalogReviewAssignmentView(
  store: CrossRunAuditCatalogReviewAssignmentStore,
  reviewSignals: CrossRunAuditCatalogReviewSignalQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogReviewAssignmentView | undefined> {
  const assignment = await store.getCatalogReviewAssignment(id);

  return assignment
    ? resolveCatalogReviewAssignmentFromValue(reviewSignals, assignment, viewer)
    : undefined;
}

async function resolveCatalogReviewAssignmentFromValue(
  reviewSignals: CrossRunAuditCatalogReviewSignalQuery,
  assignment: CrossRunAuditCatalogReviewAssignment,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogReviewAssignmentView | undefined> {
  if (
    assignment.scopeId !== viewer.scopeId ||
    (assignment.assignerId !== viewer.operatorId &&
      assignment.assigneeId !== viewer.operatorId)
  ) {
    return undefined;
  }

  const review = await reviewSignals.getCatalogReviewSignal(
    assignment.catalogEntryId,
    viewer,
  );

  if (!review) {
    return undefined;
  }

  return {
    assignment,
    review,
  };
}

async function resolveCatalogAssignmentChecklistView(
  store: CrossRunAuditCatalogAssignmentChecklistStore,
  assignments: CrossRunAuditCatalogReviewAssignmentQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogAssignmentChecklistView | undefined> {
  const checklist = await store.getCatalogAssignmentChecklist(id);

  return checklist
    ? resolveCatalogAssignmentChecklistFromValue(assignments, checklist, viewer)
    : undefined;
}

async function resolveCatalogAssignmentChecklistFromValue(
  assignments: CrossRunAuditCatalogReviewAssignmentQuery,
  checklist: CrossRunAuditCatalogAssignmentChecklist,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogAssignmentChecklistView | undefined> {
  if (checklist.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const assignment = await assignments.getCatalogReviewAssignment(
    checklist.catalogEntryId,
    viewer,
  );

  if (!assignment) {
    return undefined;
  }

  return {
    assignment,
    checklist,
  };
}

async function resolveCatalogChecklistItemProgressView(
  store: CrossRunAuditCatalogChecklistItemProgressStore,
  checklists: CrossRunAuditCatalogAssignmentChecklistQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemProgressView | undefined> {
  const progress = await store.getCatalogChecklistItemProgress(id);

  return progress
    ? resolveCatalogChecklistItemProgressFromValue(checklists, progress, viewer)
    : undefined;
}

async function resolveCatalogChecklistItemProgressFromValue(
  checklists: CrossRunAuditCatalogAssignmentChecklistQuery,
  progress: CrossRunAuditCatalogChecklistItemProgress,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemProgressView | undefined> {
  if (progress.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const checklist = await checklists.getCatalogAssignmentChecklist(
    progress.catalogEntryId,
    viewer,
  );

  if (!checklist) {
    return undefined;
  }

  const normalizedItems = normalizeChecklistItemProgressItems(
    progress.items,
    checklist.checklist.items ?? [],
  );

  if (normalizedItems.length === 0) {
    return undefined;
  }

  return {
    checklist,
    progress: {
      ...progress,
      items: normalizedItems,
    },
  };
}

async function resolveCatalogChecklistItemBlockerView(
  store: CrossRunAuditCatalogChecklistItemBlockerStore,
  progress: CrossRunAuditCatalogChecklistItemProgressQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemBlockerView | undefined> {
  const blocker = await store.getCatalogChecklistItemBlocker(id);

  return blocker
    ? resolveCatalogChecklistItemBlockerFromValue(progress, blocker, viewer)
    : undefined;
}

async function resolveCatalogChecklistItemBlockerFromValue(
  progressQuery: CrossRunAuditCatalogChecklistItemProgressQuery,
  blocker: CrossRunAuditCatalogChecklistItemBlocker,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemBlockerView | undefined> {
  if (blocker.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const progress = await progressQuery.getCatalogChecklistItemProgress(
    blocker.catalogEntryId,
    viewer,
  );

  if (!progress) {
    return undefined;
  }

  const normalizedItems = normalizeChecklistItemBlockerItems(
    blocker.items,
    progress.progress.items.map((item) => item.item),
  );

  if (normalizedItems.length === 0) {
    return undefined;
  }

  return {
    blocker: {
      ...blocker,
      items: normalizedItems,
    },
    progress,
  };
}

async function resolveCatalogChecklistItemResolutionView(
  store: CrossRunAuditCatalogChecklistItemResolutionStore,
  blockers: CrossRunAuditCatalogChecklistItemBlockerQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemResolutionView | undefined> {
  const resolution = await store.getCatalogChecklistItemResolution(id);

  return resolution
    ? resolveCatalogChecklistItemResolutionFromValue(
        blockers,
        resolution,
        viewer,
      )
    : undefined;
}

async function resolveCatalogChecklistItemResolutionFromValue(
  blockerQuery: CrossRunAuditCatalogChecklistItemBlockerQuery,
  resolution: CrossRunAuditCatalogChecklistItemResolution,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemResolutionView | undefined> {
  if (resolution.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const blocker = await blockerQuery.getCatalogChecklistItemBlocker(
    resolution.catalogEntryId,
    viewer,
  );

  if (!blocker) {
    return undefined;
  }

  const normalizedItems = normalizeChecklistItemResolutionItems(
    resolution.items,
    blocker.blocker.items.map((item) => item.item),
  );

  if (normalizedItems.length === 0) {
    return undefined;
  }

  return {
    blocker,
    resolution: {
      ...resolution,
      items: normalizedItems,
    },
  };
}

async function resolveCatalogChecklistItemVerificationView(
  store: CrossRunAuditCatalogChecklistItemVerificationStore,
  resolutions: CrossRunAuditCatalogChecklistItemResolutionQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemVerificationView | undefined> {
  const verification = await store.getCatalogChecklistItemVerification(id);

  return verification
    ? resolveCatalogChecklistItemVerificationFromValue(
        resolutions,
        verification,
        viewer,
      )
    : undefined;
}

async function resolveCatalogChecklistItemVerificationFromValue(
  resolutionQuery: CrossRunAuditCatalogChecklistItemResolutionQuery,
  verification: CrossRunAuditCatalogChecklistItemVerification,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemVerificationView | undefined> {
  if (verification.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const resolution = await resolutionQuery.getCatalogChecklistItemResolution(
    verification.catalogEntryId,
    viewer,
  );

  if (!resolution) {
    return undefined;
  }

  const normalizedItems = normalizeChecklistItemVerificationItems(
    verification.items,
    resolution.resolution.items.map((item) => item.item),
  );

  if (normalizedItems.length === 0) {
    return undefined;
  }

  return {
    resolution,
    verification: {
      ...verification,
      items: normalizedItems,
    },
  };
}

async function resolveCatalogChecklistItemEvidenceView(
  store: CrossRunAuditCatalogChecklistItemEvidenceStore,
  verifications: CrossRunAuditCatalogChecklistItemVerificationQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemEvidenceView | undefined> {
  const evidence = await store.getCatalogChecklistItemEvidence(id);

  return evidence
    ? resolveCatalogChecklistItemEvidenceFromValue(
        verifications,
        evidence,
        viewer,
      )
    : undefined;
}

async function resolveCatalogChecklistItemEvidenceFromValue(
  verificationQuery: CrossRunAuditCatalogChecklistItemVerificationQuery,
  evidence: CrossRunAuditCatalogChecklistItemEvidence,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemEvidenceView | undefined> {
  if (evidence.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const verification =
    await verificationQuery.getCatalogChecklistItemVerification(
      evidence.catalogEntryId,
      viewer,
    );

  if (!verification) {
    return undefined;
  }

  const normalizedItems = normalizeChecklistItemEvidenceItems(
    evidence.items,
    verification.verification.items.map((item) => item.item),
  );

  if (normalizedItems.length === 0) {
    return undefined;
  }

  return {
    evidence: {
      ...evidence,
      items: normalizedItems,
    },
    verification,
  };
}

async function resolveCatalogChecklistItemAttestationView(
  store: CrossRunAuditCatalogChecklistItemAttestationStore,
  evidenceQuery: CrossRunAuditCatalogChecklistItemEvidenceQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemAttestationView | undefined> {
  const attestation = await store.getCatalogChecklistItemAttestation(id);

  return attestation
    ? resolveCatalogChecklistItemAttestationFromValue(
        evidenceQuery,
        attestation,
        viewer,
      )
    : undefined;
}

async function resolveCatalogChecklistItemAttestationFromValue(
  evidenceQuery: CrossRunAuditCatalogChecklistItemEvidenceQuery,
  attestation: CrossRunAuditCatalogChecklistItemAttestation,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemAttestationView | undefined> {
  if (attestation.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const evidence = await evidenceQuery.getCatalogChecklistItemEvidence(
    attestation.catalogEntryId,
    viewer,
  );

  if (!evidence) {
    return undefined;
  }

  const normalizedItems = normalizeChecklistItemAttestationItems(
    attestation.items,
    evidence.evidence.items.map((item) => item.item),
  );

  if (normalizedItems.length === 0) {
    return undefined;
  }

  return {
    attestation: {
      ...attestation,
      items: normalizedItems,
    },
    evidence,
  };
}

async function resolveCatalogChecklistItemAcknowledgmentView(
  store: CrossRunAuditCatalogChecklistItemAcknowledgmentStore,
  attestationQuery: CrossRunAuditCatalogChecklistItemAttestationQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemAcknowledgmentView | undefined> {
  const acknowledgment = await store.getCatalogChecklistItemAcknowledgment(id);

  return acknowledgment
    ? resolveCatalogChecklistItemAcknowledgmentFromValue(
        attestationQuery,
        acknowledgment,
        viewer,
      )
    : undefined;
}

async function resolveCatalogChecklistItemAcknowledgmentFromValue(
  attestationQuery: CrossRunAuditCatalogChecklistItemAttestationQuery,
  acknowledgment: CrossRunAuditCatalogChecklistItemAcknowledgment,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemAcknowledgmentView | undefined> {
  if (acknowledgment.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const attestation = await attestationQuery.getCatalogChecklistItemAttestation(
    acknowledgment.catalogEntryId,
    viewer,
  );

  if (!attestation) {
    return undefined;
  }

  const normalizedItems = normalizeChecklistItemAcknowledgmentItems(
    acknowledgment.items,
    attestation.attestation.items.map((item) => item.item),
  );

  if (normalizedItems.length === 0) {
    return undefined;
  }

  return {
    acknowledgment: {
      ...acknowledgment,
      items: normalizedItems,
    },
    attestation,
  };
}

async function resolveCatalogChecklistItemSignoffView(
  store: CrossRunAuditCatalogChecklistItemSignoffStore,
  acknowledgmentQuery: CrossRunAuditCatalogChecklistItemAcknowledgmentQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemSignoffView | undefined> {
  const signoff = await store.getCatalogChecklistItemSignoff(id);

  return signoff
    ? resolveCatalogChecklistItemSignoffFromValue(
        acknowledgmentQuery,
        signoff,
        viewer,
      )
    : undefined;
}

async function resolveCatalogChecklistItemSignoffFromValue(
  acknowledgmentQuery: CrossRunAuditCatalogChecklistItemAcknowledgmentQuery,
  signoff: CrossRunAuditCatalogChecklistItemSignoff,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemSignoffView | undefined> {
  if (signoff.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const acknowledgment =
    await acknowledgmentQuery.getCatalogChecklistItemAcknowledgment(
      signoff.catalogEntryId,
      viewer,
    );

  if (!acknowledgment) {
    return undefined;
  }

  const normalizedItems = normalizeChecklistItemSignoffItems(
    signoff.items,
    acknowledgment.acknowledgment.items.map((item) => item.item),
  );

  if (normalizedItems.length === 0) {
    return undefined;
  }

  return {
    acknowledgment,
    signoff: {
      ...signoff,
      items: normalizedItems,
    },
  };
}

async function resolveCatalogChecklistItemExceptionView(
  store: CrossRunAuditCatalogChecklistItemExceptionStore,
  signoffQuery: CrossRunAuditCatalogChecklistItemSignoffQuery,
  id: string,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemExceptionView | undefined> {
  const exception = await store.getCatalogChecklistItemException(id);

  return exception
    ? resolveCatalogChecklistItemExceptionFromValue(
        signoffQuery,
        exception,
        viewer,
      )
    : undefined;
}

async function resolveCatalogChecklistItemExceptionFromValue(
  signoffQuery: CrossRunAuditCatalogChecklistItemSignoffQuery,
  exception: CrossRunAuditCatalogChecklistItemException,
  viewer: CrossRunAuditCatalogVisibilityViewer,
): Promise<CrossRunAuditCatalogChecklistItemExceptionView | undefined> {
  if (exception.scopeId !== viewer.scopeId) {
    return undefined;
  }

  const signoff = await signoffQuery.getCatalogChecklistItemSignoff(
    exception.catalogEntryId,
    viewer,
  );

  if (!signoff) {
    return undefined;
  }

  const normalizedItems = normalizeChecklistItemExceptionItems(
    exception.items,
    signoff.signoff.items.map((item) => item.item),
  );

  if (normalizedItems.length === 0) {
    return undefined;
  }

  return {
    exception: {
      ...exception,
      items: normalizedItems,
    },
    signoff,
  };
}
