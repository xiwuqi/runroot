import { describe, expect, it } from "vitest";

import { createCrossRunAuditCatalogQuery } from "./query";
import { createCrossRunAuditSavedView } from "./saved-view";

function createSavedView(id: string, timestamp: string) {
  return createCrossRunAuditSavedView({
    id,
    name: `Saved view ${id}`,
    navigation: {
      drilldown: {
        workerId: "worker_catalog",
      },
      summary: {
        executionMode: "queued",
      },
    },
    refs: {
      auditViewRunId: "run_queued",
      drilldownRunId: "run_queued",
    },
    timestamp,
  });
}

describe("@runroot/replay audit view catalog", () => {
  it("publishes, lists, inspects, archives, and applies catalog entries through the shared query seam", async () => {
    const savedView = createSavedView(
      "saved_view_queued",
      "2026-03-29T12:00:00.000Z",
    );
    const catalogEntries: Array<{
      archivedAt?: string;
      createdAt: string;
      description?: string;
      id: string;
      kind: "catalog-entry";
      name: string;
      savedViewId: string;
      updatedAt: string;
    }> = [];
    const catalogStore = {
      async getCatalogEntry(id: string) {
        return catalogEntries.find((entry) => entry.id === id);
      },
      async listCatalogEntries() {
        return [...catalogEntries];
      },
      async saveCatalogEntry(entry: (typeof catalogEntries)[number]) {
        const existingIndex = catalogEntries.findIndex(
          (candidate) => candidate.id === entry.id,
        );

        if (existingIndex >= 0) {
          catalogEntries.splice(existingIndex, 1);
        }

        catalogEntries.push(entry);

        return entry;
      },
    };
    const savedViewQuery = {
      async applySavedView(id: string) {
        return id === savedView.id
          ? {
              navigation: {
                drilldowns: [],
                filters: savedView.navigation,
                isConstrained: true,
                summaries: [],
                totalDrilldownCount: 0,
                totalMatchedEntryCount: 0,
                totalSummaryCount: 1,
              },
              savedView,
            }
          : undefined;
      },
      async getSavedView(id: string) {
        return id === savedView.id ? savedView : undefined;
      },
      async listSavedViews() {
        return {
          items: [savedView],
          totalCount: 1,
        };
      },
      async saveSavedView() {
        return savedView;
      },
    };
    const catalogQuery = createCrossRunAuditCatalogQuery(
      catalogStore,
      savedViewQuery,
    );

    const publishedEntry = await catalogQuery.publishCatalogEntry({
      id: "catalog_entry_1",
      savedViewId: savedView.id,
      timestamp: "2026-03-29T12:00:05.000Z",
    });
    const listedEntries = await catalogQuery.listCatalogEntries();
    const inspectedEntry =
      await catalogQuery.getCatalogEntry("catalog_entry_1");
    const appliedEntry =
      await catalogQuery.applyCatalogEntry("catalog_entry_1");
    const archivedEntry = await catalogQuery.archiveCatalogEntry(
      "catalog_entry_1",
      "2026-03-29T12:00:10.000Z",
    );
    const listedAfterArchive = await catalogQuery.listCatalogEntries();
    const appliedArchivedEntry =
      await catalogQuery.applyCatalogEntry("catalog_entry_1");

    expect(publishedEntry).toMatchObject({
      entry: {
        id: "catalog_entry_1",
        kind: "catalog-entry",
        name: savedView.name,
        savedViewId: savedView.id,
      },
      savedView: {
        id: savedView.id,
      },
    });
    expect(listedEntries.totalCount).toBe(1);
    expect(listedEntries.items[0]?.entry.id).toBe("catalog_entry_1");
    expect(inspectedEntry?.savedView.id).toBe(savedView.id);
    expect(appliedEntry?.catalogEntry.entry.id).toBe("catalog_entry_1");
    expect(appliedEntry?.application.savedView.id).toBe(savedView.id);
    expect(archivedEntry?.entry.archivedAt).toBe("2026-03-29T12:00:10.000Z");
    expect(listedAfterArchive.totalCount).toBe(0);
    expect(appliedArchivedEntry).toBeUndefined();
  });
});
