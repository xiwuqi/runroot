import { describe, expect, it } from "vitest";

import {
  createCrossRunAuditCatalogQuery,
  createCrossRunAuditCatalogReviewSignalQuery,
  createCrossRunAuditCatalogVisibilityQuery,
} from "./query";
import { createCrossRunAuditSavedView } from "./saved-view";

function createSavedView(id: string, workerId: string, timestamp: string) {
  return createCrossRunAuditSavedView({
    id,
    name: `Saved view ${id}`,
    navigation: {
      drilldown: {
        workerId,
      },
      summary: {
        executionMode: workerId.includes("queued") ? "queued" : "inline",
      },
    },
    refs: {
      auditViewRunId: `run_${workerId}`,
      drilldownRunId: `run_${workerId}`,
    },
    timestamp,
  });
}

describe("@runroot/replay audit catalog review signals", () => {
  it("sets, lists, inspects, clears, and reuses reviewed presets through the shared query seam", async () => {
    const inlineSavedView = createSavedView(
      "saved_view_inline",
      "worker_inline_review",
      "2026-03-30T14:00:00.000Z",
    );
    const queuedSavedView = createSavedView(
      "saved_view_queued",
      "worker_queued_review",
      "2026-03-30T14:00:01.000Z",
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
    const catalogVisibility: Array<{
      catalogEntryId: string;
      createdAt: string;
      kind: "catalog-visibility";
      ownerId: string;
      scopeId: string;
      state: "personal" | "shared";
      updatedAt: string;
    }> = [];
    const reviewSignals: Array<{
      catalogEntryId: string;
      createdAt: string;
      kind: "catalog-review-signal";
      note?: string;
      operatorId: string;
      scopeId: string;
      state: "recommended" | "reviewed";
      updatedAt: string;
    }> = [];
    const savedViewQuery = {
      async applySavedView(id: string) {
        const savedView =
          id === inlineSavedView.id
            ? inlineSavedView
            : id === queuedSavedView.id
              ? queuedSavedView
              : undefined;

        return savedView
          ? {
              navigation: {
                drilldowns: [
                  {
                    links: {
                      auditView: {
                        kind: "run-audit-view" as const,
                        label: savedView.name,
                        runId:
                          savedView.refs.drilldownRunId ??
                          savedView.refs.auditViewRunId ??
                          "run_unknown",
                        summary: savedView.name,
                      },
                    },
                    result: {
                      definitionId: "shell-runbook-flow",
                      definitionName: "Shell runbook flow",
                      entries: [],
                      identifiers: {
                        approvalIds: [],
                        dispatchJobIds: [],
                        runIds: [],
                        stepIds: [],
                        toolCallIds: [],
                        toolIds: [],
                        workerIds: [
                          savedView.navigation.drilldown.workerId ?? "",
                        ],
                      },
                      matchedEntryCount: 0,
                      runId:
                        savedView.refs.drilldownRunId ??
                        savedView.refs.auditViewRunId ??
                        "run_unknown",
                      runStatus: "succeeded" as const,
                      summary: savedView.name,
                      updatedAt: savedView.updatedAt,
                    },
                  },
                ],
                filters: savedView.navigation,
                isConstrained: true,
                summaries: [],
                totalDrilldownCount: 1,
                totalMatchedEntryCount: 1,
                totalSummaryCount: 1,
              },
              savedView,
            }
          : undefined;
      },
      async getSavedView(id: string) {
        return id === inlineSavedView.id
          ? inlineSavedView
          : id === queuedSavedView.id
            ? queuedSavedView
            : undefined;
      },
      async listSavedViews() {
        return {
          items: [queuedSavedView, inlineSavedView],
          totalCount: 2,
        };
      },
      async saveSavedView() {
        return inlineSavedView;
      },
    };
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
    const visibilityStore = {
      async getCatalogVisibility(catalogEntryId: string) {
        return catalogVisibility.find(
          (entry) => entry.catalogEntryId === catalogEntryId,
        );
      },
      async listCatalogVisibility() {
        return [...catalogVisibility];
      },
      async saveCatalogVisibility(entry: (typeof catalogVisibility)[number]) {
        const existingIndex = catalogVisibility.findIndex(
          (candidate) => candidate.catalogEntryId === entry.catalogEntryId,
        );

        if (existingIndex >= 0) {
          catalogVisibility.splice(existingIndex, 1);
        }

        catalogVisibility.push(entry);

        return entry;
      },
    };
    const reviewSignalStore = {
      async deleteCatalogReviewSignal(catalogEntryId: string) {
        const existingIndex = reviewSignals.findIndex(
          (entry) => entry.catalogEntryId === catalogEntryId,
        );

        if (existingIndex < 0) {
          return undefined;
        }

        const [deleted] = reviewSignals.splice(existingIndex, 1);

        return deleted;
      },
      async getCatalogReviewSignal(catalogEntryId: string) {
        return reviewSignals.find(
          (entry) => entry.catalogEntryId === catalogEntryId,
        );
      },
      async listCatalogReviewSignals() {
        return [...reviewSignals];
      },
      async saveCatalogReviewSignal(entry: (typeof reviewSignals)[number]) {
        const existingIndex = reviewSignals.findIndex(
          (candidate) => candidate.catalogEntryId === entry.catalogEntryId,
        );

        if (existingIndex >= 0) {
          reviewSignals.splice(existingIndex, 1);
        }

        reviewSignals.push(entry);

        return entry;
      },
    };
    const catalogQuery = createCrossRunAuditCatalogQuery(
      catalogStore,
      savedViewQuery,
    );
    const visibilityQuery = createCrossRunAuditCatalogVisibilityQuery(
      visibilityStore,
      catalogQuery,
    );
    const reviewSignalQuery = createCrossRunAuditCatalogReviewSignalQuery(
      reviewSignalStore,
      visibilityQuery,
    );
    const ownerViewer = {
      operatorId: "ops_oncall",
      scopeId: "ops",
    };
    const peerViewer = {
      operatorId: "ops_backup",
      scopeId: "ops",
    };
    const otherScopeViewer = {
      operatorId: "sec_oncall",
      scopeId: "security",
    };

    await catalogQuery.publishCatalogEntry({
      id: "catalog_inline",
      savedViewId: inlineSavedView.id,
      timestamp: "2026-03-30T14:00:05.000Z",
    });
    await catalogQuery.publishCatalogEntry({
      id: "catalog_queued",
      savedViewId: queuedSavedView.id,
      timestamp: "2026-03-30T14:00:06.000Z",
    });
    await visibilityQuery.setCatalogVisibilityState(
      "catalog_inline",
      ownerViewer,
      "personal",
      "2026-03-30T14:00:07.000Z",
    );
    await visibilityQuery.setCatalogVisibilityState(
      "catalog_queued",
      ownerViewer,
      "shared",
      "2026-03-30T14:00:08.000Z",
    );

    await reviewSignalQuery.setCatalogReviewSignal(
      "catalog_inline",
      ownerViewer,
      {
        note: "Verified for owner-only follow-up",
        state: "reviewed",
      },
      "2026-03-30T14:00:09.000Z",
    );
    await reviewSignalQuery.setCatalogReviewSignal(
      "catalog_queued",
      peerViewer,
      {
        note: "Preferred queued preset for on-call handoff",
        state: "recommended",
      },
      "2026-03-30T14:00:10.000Z",
    );

    const ownerReviewed =
      await reviewSignalQuery.listReviewedCatalogEntries(ownerViewer);
    const peerReviewed =
      await reviewSignalQuery.listReviewedCatalogEntries(peerViewer);
    const otherScopeReviewed =
      await reviewSignalQuery.listReviewedCatalogEntries(otherScopeViewer);
    const ownerInspection = await reviewSignalQuery.getCatalogReviewSignal(
      "catalog_queued",
      ownerViewer,
    );
    const peerApplication = await visibilityQuery.applyCatalogEntry(
      "catalog_queued",
      peerViewer,
    );
    const clearedReview = await reviewSignalQuery.clearCatalogReviewSignal(
      "catalog_queued",
      ownerViewer,
    );
    const peerReviewedAfterClear =
      await reviewSignalQuery.listReviewedCatalogEntries(peerViewer);

    expect(
      ownerReviewed.items.map((item) => item.visibility.catalogEntry.entry.id),
    ).toEqual(["catalog_queued", "catalog_inline"]);
    expect(
      peerReviewed.items.map((item) => item.visibility.catalogEntry.entry.id),
    ).toEqual(["catalog_queued"]);
    expect(otherScopeReviewed.totalCount).toBe(0);
    expect(ownerInspection?.review).toMatchObject({
      catalogEntryId: "catalog_queued",
      note: "Preferred queued preset for on-call handoff",
      operatorId: "ops_backup",
      scopeId: "ops",
      state: "recommended",
    });
    expect(
      peerApplication?.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe("run_worker_queued_review");
    expect(clearedReview?.review.state).toBe("recommended");
    expect(peerReviewedAfterClear.totalCount).toBe(0);
  });
});
