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
