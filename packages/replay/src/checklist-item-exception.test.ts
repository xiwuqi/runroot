import { describe, expect, it } from "vitest";

import {
  compareCrossRunAuditCatalogChecklistItemException,
  createCrossRunAuditCatalogChecklistItemException,
  normalizeChecklistItemExceptionItems,
} from "./checklist-item-exception";

describe("@runroot/replay audit catalog checklist item exception", () => {
  it("creates checklist item exception with normalized metadata", () => {
    const exception = createCrossRunAuditCatalogChecklistItemException({
      exceptionNote: " Escalate the signed-off follow-up for manual review ",
      catalogEntryId: " catalog_entry_exception ",
      items: [
        {
          item: "Validate queued follow-up",
          state: "excepted",
        },
        {
          item: "Close backup handoff",
          state: "not-excepted",
        },
      ],
      operatorId: " ops_oncall ",
      scopeId: " ops ",
      timestamp: "2026-04-04T04:00:00.000Z",
    });

    expect(exception).toEqual({
      exceptionNote: "Escalate the signed-off follow-up for manual review",
      catalogEntryId: "catalog_entry_exception",
      createdAt: "2026-04-04T04:00:00.000Z",
      items: [
        {
          item: "Validate queued follow-up",
          state: "excepted",
        },
        {
          item: "Close backup handoff",
          state: "not-excepted",
        },
      ],
      kind: "catalog-checklist-item-exception",
      operatorId: "ops_oncall",
      scopeId: "ops",
      updatedAt: "2026-04-04T04:00:00.000Z",
    });
  });

  it("restricts checklist item exceptions to shared sign-off items", () => {
    expect(() =>
      normalizeChecklistItemExceptionItems(
        [
          {
            item: "Missing item",
            state: "excepted",
          },
        ],
        ["Validate queued follow-up", "Close backup handoff"],
      ),
    ).toThrow(
      'Catalog checklist item exception "Missing item" is not defined on the shared checklist item sign-off layer.',
    );
  });

  it("sorts excepted entries ahead of non-excepted entries", () => {
    const olderEntry = createCrossRunAuditCatalogChecklistItemException({
      catalogEntryId: "catalog_entry_older",
      items: [
        {
          item: "Validate queued follow-up",
          state: "not-excepted",
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-04T04:00:00.000Z",
    });
    const newerEntry = createCrossRunAuditCatalogChecklistItemException({
      catalogEntryId: "catalog_entry_newer",
      items: [
        {
          item: "Validate queued follow-up",
          state: "excepted",
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-04T04:00:01.000Z",
    });

    expect(
      [olderEntry, newerEntry].sort(
        compareCrossRunAuditCatalogChecklistItemException,
      ),
    ).toEqual([newerEntry, olderEntry]);
  });
});
