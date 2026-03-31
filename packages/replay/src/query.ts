import type { DispatchJob } from "@runroot/dispatch";
import type { RunId, WorkflowRun } from "@runroot/domain";
import type { RuntimeEvent } from "@runroot/events";
import type { ToolHistoryEntry } from "@runroot/tools";

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
