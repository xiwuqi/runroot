import { describe, expect, it } from "vitest";
import { createCrossRunAuditSavedViewQuery } from "./query";
import {
  compareCrossRunAuditSavedViews,
  createCrossRunAuditSavedView,
} from "./saved-view";

function createSavedView(id: string, timestamp: string) {
  return createCrossRunAuditSavedView({
    id,
    name: `Saved view ${id}`,
    navigation: {
      drilldown: {
        workerId: "worker_1",
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

describe("@runroot/replay saved audit views", () => {
  it("creates saved views from constrained navigation state only", () => {
    expect(() =>
      createCrossRunAuditSavedView({
        id: "saved_empty",
        name: "   ",
        timestamp: "2026-03-29T12:00:00.000Z",
      }),
    ).toThrow("Saved audit views require a non-empty name.");

    expect(() =>
      createCrossRunAuditSavedView({
        id: "saved_empty",
        name: "Empty",
        timestamp: "2026-03-29T12:00:00.000Z",
      }),
    ).toThrow(
      "Saved audit views require at least one stable filter or navigation reference.",
    );
  });

  it("lists, loads, and applies saved views through the shared query seam", async () => {
    const firstSavedView = createSavedView(
      "saved_first",
      "2026-03-29T12:00:00.000Z",
    );
    const secondSavedView = createSavedView(
      "saved_second",
      "2026-03-29T12:00:05.000Z",
    );
    const store = {
      async getSavedView(id: string) {
        return [firstSavedView, secondSavedView].find(
          (savedView) => savedView.id === id,
        );
      },
      async listSavedViews() {
        return [firstSavedView, secondSavedView];
      },
      async saveSavedView(savedView: typeof firstSavedView) {
        return savedView;
      },
    };
    const query = createCrossRunAuditSavedViewQuery(store, {
      async getAuditNavigation(filters) {
        return {
          drilldowns: [],
          filters: {
            drilldown: filters?.drilldown ?? {},
            summary: filters?.summary ?? {},
          },
          isConstrained: true,
          summaries: [],
          totalDrilldownCount: 0,
          totalMatchedEntryCount: 0,
          totalSummaryCount: 0,
        };
      },
    });

    const savedViews = await query.listSavedViews();
    const application = await query.applySavedView("saved_second");

    expect(
      [...savedViews.items]
        .sort(compareCrossRunAuditSavedViews)
        .map((item) => item.id),
    ).toEqual(["saved_second", "saved_first"]);
    expect(application?.savedView.id).toBe("saved_second");
    expect(application?.navigation.filters.summary.executionMode).toBe(
      "queued",
    );
    expect(application?.navigation.filters.drilldown.workerId).toBe("worker_1");
  });
});
