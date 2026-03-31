import { describe, expect, it } from "vitest";

import {
  createCrossRunAuditCatalogAssignmentChecklistQuery,
  createCrossRunAuditCatalogChecklistItemProgressQuery,
  createCrossRunAuditCatalogQuery,
  createCrossRunAuditCatalogReviewAssignmentQuery,
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

describe("@runroot/replay audit catalog checklist item progress", () => {
  it("stores, lists, inspects, clears, and reapplies checklist item progress through the shared query seam", async () => {
    const inlineSavedView = createSavedView(
      "saved_view_inline",
      "worker_inline_progress",
      "2026-03-31T02:00:00.000Z",
    );
    const queuedSavedView = createSavedView(
      "saved_view_queued",
      "worker_queued_progress",
      "2026-03-31T02:00:01.000Z",
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
    const assignments: Array<{
      assigneeId: string;
      assignerId: string;
      catalogEntryId: string;
      createdAt: string;
      handoffNote?: string;
      kind: "catalog-review-assignment";
      scopeId: string;
      state: "assigned";
      updatedAt: string;
    }> = [];
    const checklists: Array<{
      catalogEntryId: string;
      createdAt: string;
      items?: readonly string[];
      kind: "catalog-assignment-checklist";
      operatorId: string;
      scopeId: string;
      state: "completed" | "pending";
      updatedAt: string;
    }> = [];
    const progressEntries: Array<{
      catalogEntryId: string;
      completionNote?: string;
      createdAt: string;
      items: readonly {
        item: string;
        state: "completed" | "pending";
      }[];
      kind: "catalog-checklist-item-progress";
      operatorId: string;
      scopeId: string;
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
    const assignmentStore = {
      async deleteCatalogReviewAssignment(catalogEntryId: string) {
        const existingIndex = assignments.findIndex(
          (entry) => entry.catalogEntryId === catalogEntryId,
        );

        if (existingIndex < 0) {
          return undefined;
        }

        const [deleted] = assignments.splice(existingIndex, 1);

        return deleted;
      },
      async getCatalogReviewAssignment(catalogEntryId: string) {
        return assignments.find(
          (entry) => entry.catalogEntryId === catalogEntryId,
        );
      },
      async listCatalogReviewAssignments() {
        return [...assignments];
      },
      async saveCatalogReviewAssignment(entry: (typeof assignments)[number]) {
        const existingIndex = assignments.findIndex(
          (candidate) => candidate.catalogEntryId === entry.catalogEntryId,
        );

        if (existingIndex >= 0) {
          assignments.splice(existingIndex, 1);
        }

        assignments.push(entry);

        return entry;
      },
    };
    const checklistStore = {
      async deleteCatalogAssignmentChecklist(catalogEntryId: string) {
        const existingIndex = checklists.findIndex(
          (entry) => entry.catalogEntryId === catalogEntryId,
        );

        if (existingIndex < 0) {
          return undefined;
        }

        const [deleted] = checklists.splice(existingIndex, 1);

        return deleted;
      },
      async getCatalogAssignmentChecklist(catalogEntryId: string) {
        return checklists.find(
          (entry) => entry.catalogEntryId === catalogEntryId,
        );
      },
      async listCatalogAssignmentChecklists() {
        return [...checklists];
      },
      async saveCatalogAssignmentChecklist(entry: (typeof checklists)[number]) {
        const existingIndex = checklists.findIndex(
          (candidate) => candidate.catalogEntryId === entry.catalogEntryId,
        );

        if (existingIndex >= 0) {
          checklists.splice(existingIndex, 1);
        }

        checklists.push(entry);

        return entry;
      },
    };
    const progressStore = {
      async deleteCatalogChecklistItemProgress(catalogEntryId: string) {
        const existingIndex = progressEntries.findIndex(
          (entry) => entry.catalogEntryId === catalogEntryId,
        );

        if (existingIndex < 0) {
          return undefined;
        }

        const [deleted] = progressEntries.splice(existingIndex, 1);

        return deleted;
      },
      async getCatalogChecklistItemProgress(catalogEntryId: string) {
        return progressEntries.find(
          (entry) => entry.catalogEntryId === catalogEntryId,
        );
      },
      async listCatalogChecklistItemProgress() {
        return [...progressEntries];
      },
      async saveCatalogChecklistItemProgress(
        entry: (typeof progressEntries)[number],
      ) {
        const existingIndex = progressEntries.findIndex(
          (candidate) => candidate.catalogEntryId === entry.catalogEntryId,
        );

        if (existingIndex >= 0) {
          progressEntries.splice(existingIndex, 1);
        }

        progressEntries.push(entry);

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
    const assignmentQuery = createCrossRunAuditCatalogReviewAssignmentQuery(
      assignmentStore,
      reviewSignalQuery,
      visibilityQuery,
    );
    const checklistQuery = createCrossRunAuditCatalogAssignmentChecklistQuery(
      checklistStore,
      assignmentQuery,
    );
    const progressQuery = createCrossRunAuditCatalogChecklistItemProgressQuery(
      progressStore,
      checklistQuery,
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
      timestamp: "2026-03-31T02:00:02.000Z",
    });
    await catalogQuery.publishCatalogEntry({
      id: "catalog_queued",
      savedViewId: queuedSavedView.id,
      timestamp: "2026-03-31T02:00:03.000Z",
    });
    await visibilityQuery.setCatalogVisibilityState(
      "catalog_inline",
      ownerViewer,
      "personal",
      "2026-03-31T02:00:04.000Z",
    );
    await visibilityQuery.setCatalogVisibilityState(
      "catalog_queued",
      ownerViewer,
      "shared",
      "2026-03-31T02:00:05.000Z",
    );
    await reviewSignalQuery.setCatalogReviewSignal(
      "catalog_inline",
      ownerViewer,
      {
        note: "Inline preset verified by owner",
        state: "reviewed",
      },
      "2026-03-31T02:00:06.000Z",
    );
    await reviewSignalQuery.setCatalogReviewSignal(
      "catalog_queued",
      peerViewer,
      {
        note: "Queued preset ready for overnight handoff",
        state: "recommended",
      },
      "2026-03-31T02:00:07.000Z",
    );
    await assignmentQuery.setCatalogReviewAssignment(
      "catalog_inline",
      ownerViewer,
      {
        assigneeId: "ops_oncall",
        handoffNote: "Owner keeps inline progress follow-up",
      },
      "2026-03-31T02:00:08.000Z",
    );
    await assignmentQuery.setCatalogReviewAssignment(
      "catalog_queued",
      ownerViewer,
      {
        assigneeId: "ops_backup",
        handoffNote: "Queued preset handed to backup",
      },
      "2026-03-31T02:00:09.000Z",
    );
    await checklistQuery.setCatalogAssignmentChecklist(
      "catalog_inline",
      ownerViewer,
      {
        items: ["Confirm owner follow-up"],
        state: "completed",
      },
      "2026-03-31T02:00:10.000Z",
    );
    await checklistQuery.setCatalogAssignmentChecklist(
      "catalog_queued",
      ownerViewer,
      {
        items: ["Validate queued follow-up", "Close backup handoff"],
        state: "pending",
      },
      "2026-03-31T02:00:11.000Z",
    );
    await progressQuery.setCatalogChecklistItemProgress(
      "catalog_inline",
      ownerViewer,
      {
        items: [
          {
            item: "Confirm owner follow-up",
            state: "completed",
          },
        ],
      },
      "2026-03-31T02:00:12.000Z",
    );
    await progressQuery.setCatalogChecklistItemProgress(
      "catalog_queued",
      ownerViewer,
      {
        completionNote: "Queued follow-up is almost complete",
        items: [
          {
            item: "Validate queued follow-up",
            state: "completed",
          },
          {
            item: "Close backup handoff",
            state: "pending",
          },
        ],
      },
      "2026-03-31T02:00:13.000Z",
    );

    const ownerProgress =
      await progressQuery.listProgressedCatalogEntries(ownerViewer);
    const peerProgress =
      await progressQuery.listProgressedCatalogEntries(peerViewer);
    const otherScopeProgress =
      await progressQuery.listProgressedCatalogEntries(otherScopeViewer);
    const inspectedProgress =
      await progressQuery.getCatalogChecklistItemProgress(
        "catalog_queued",
        ownerViewer,
      );
    const appliedProgress = await progressQuery.applyCatalogEntry(
      "catalog_queued",
      peerViewer,
    );
    const clearedProgress =
      await progressQuery.clearCatalogChecklistItemProgress(
        "catalog_queued",
        ownerViewer,
      );
    const peerProgressAfterClear =
      await progressQuery.listProgressedCatalogEntries(peerViewer);

    expect(
      ownerProgress.items.map(
        (item) =>
          item.checklist.assignment.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual(["catalog_queued", "catalog_inline"]);
    expect(
      peerProgress.items.map(
        (item) =>
          item.checklist.assignment.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual(["catalog_queued"]);
    expect(otherScopeProgress.totalCount).toBe(0);
    expect(inspectedProgress?.progress).toMatchObject({
      catalogEntryId: "catalog_queued",
      completionNote: "Queued follow-up is almost complete",
      operatorId: "ops_oncall",
      scopeId: "ops",
    });
    expect(inspectedProgress?.progress.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "completed",
      },
      {
        item: "Close backup handoff",
        state: "pending",
      },
    ]);
    expect(
      appliedProgress?.application.application.application.application
        .application.navigation.drilldowns[0]?.result.runId,
    ).toBe("run_worker_queued_progress");
    expect(clearedProgress?.progress.catalogEntryId).toBe("catalog_queued");
    expect(peerProgressAfterClear.totalCount).toBe(0);
  });
});
