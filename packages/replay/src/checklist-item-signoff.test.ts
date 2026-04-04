import { describe, expect, it } from "vitest";

import {
  compareCrossRunAuditCatalogChecklistItemSignoff,
  createCrossRunAuditCatalogChecklistItemSignoff,
  normalizeChecklistItemSignoffItems,
} from "./checklist-item-signoff";

describe("@runroot/replay audit catalog checklist item signoff", () => {
  it("creates checklist item signoff with normalized metadata", () => {
    const signoff = createCrossRunAuditCatalogChecklistItemSignoff({
      signoffNote: " Evidence is sufficient for the queued closeout ",
      catalogEntryId: " catalog_entry_signoff ",
      items: [
        {
          item: "Validate queued follow-up",
          state: "signed-off",
        },
        {
          item: "Close backup handoff",
          state: "unsigned",
        },
      ],
      operatorId: " ops_oncall ",
      scopeId: " ops ",
      timestamp: "2026-04-02T04:00:00.000Z",
    });

    expect(signoff).toEqual({
      signoffNote: "Evidence is sufficient for the queued closeout",
      catalogEntryId: "catalog_entry_signoff",
      createdAt: "2026-04-02T04:00:00.000Z",
      items: [
        {
          item: "Validate queued follow-up",
          state: "signed-off",
        },
        {
          item: "Close backup handoff",
          state: "unsigned",
        },
      ],
      kind: "catalog-checklist-item-signoff",
      operatorId: "ops_oncall",
      scopeId: "ops",
      updatedAt: "2026-04-02T04:00:00.000Z",
    });
  });

  it("restricts checklist item signoff to shared acknowledgment items", () => {
    expect(() =>
      normalizeChecklistItemSignoffItems(
        [
          {
            item: "Missing item",
            state: "signed-off",
          },
        ],
        ["Validate queued follow-up", "Close backup handoff"],
      ),
    ).toThrow(
      'Catalog checklist item signoff "Missing item" is not defined on the shared checklist item acknowledgment layer.',
    );
  });

  it("sorts newer signoff entries ahead of older signoff entries", () => {
    const olderEntry = createCrossRunAuditCatalogChecklistItemSignoff({
      catalogEntryId: "catalog_entry_older",
      items: [
        {
          item: "Validate queued follow-up",
          state: "signed-off",
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-02T04:00:00.000Z",
    });
    const newerEntry = createCrossRunAuditCatalogChecklistItemSignoff({
      catalogEntryId: "catalog_entry_newer",
      items: [
        {
          item: "Validate queued follow-up",
          state: "signed-off",
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-02T04:00:01.000Z",
    });

    expect(
      [olderEntry, newerEntry].sort(
        compareCrossRunAuditCatalogChecklistItemSignoff,
      ),
    ).toEqual([newerEntry, olderEntry]);
  });
});
