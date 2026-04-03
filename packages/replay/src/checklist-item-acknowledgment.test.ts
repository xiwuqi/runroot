import { describe, expect, it } from "vitest";

import {
  compareCrossRunAuditCatalogChecklistItemAcknowledgment,
  createCrossRunAuditCatalogChecklistItemAcknowledgment,
  normalizeChecklistItemAcknowledgmentItems,
} from "./checklist-item-acknowledgment";

describe("@runroot/replay audit catalog checklist item acknowledgment", () => {
  it("creates checklist item acknowledgment with normalized metadata", () => {
    const acknowledgment =
      createCrossRunAuditCatalogChecklistItemAcknowledgment({
        acknowledgmentNote: " Evidence is sufficient for the queued closeout ",
        catalogEntryId: " catalog_entry_acknowledgment ",
        items: [
          {
            item: "Validate queued follow-up",
            state: "acknowledged",
          },
          {
            item: "Close backup handoff",
            state: "unacknowledged",
          },
        ],
        operatorId: " ops_oncall ",
        scopeId: " ops ",
        timestamp: "2026-04-02T04:00:00.000Z",
      });

    expect(acknowledgment).toEqual({
      acknowledgmentNote: "Evidence is sufficient for the queued closeout",
      catalogEntryId: "catalog_entry_acknowledgment",
      createdAt: "2026-04-02T04:00:00.000Z",
      items: [
        {
          item: "Validate queued follow-up",
          state: "acknowledged",
        },
        {
          item: "Close backup handoff",
          state: "unacknowledged",
        },
      ],
      kind: "catalog-checklist-item-acknowledgment",
      operatorId: "ops_oncall",
      scopeId: "ops",
      updatedAt: "2026-04-02T04:00:00.000Z",
    });
  });

  it("restricts checklist item acknowledgment to shared evidence items", () => {
    expect(() =>
      normalizeChecklistItemAcknowledgmentItems(
        [
          {
            item: "Missing item",
            state: "acknowledged",
          },
        ],
        ["Validate queued follow-up", "Close backup handoff"],
      ),
    ).toThrow(
      'Catalog checklist item acknowledgment "Missing item" is not defined on the shared checklist item attestation layer.',
    );
  });

  it("sorts newer acknowledgment entries ahead of older acknowledgment entries", () => {
    const olderEntry = createCrossRunAuditCatalogChecklistItemAcknowledgment({
      catalogEntryId: "catalog_entry_older",
      items: [
        {
          item: "Validate queued follow-up",
          state: "acknowledged",
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-02T04:00:00.000Z",
    });
    const newerEntry = createCrossRunAuditCatalogChecklistItemAcknowledgment({
      catalogEntryId: "catalog_entry_newer",
      items: [
        {
          item: "Validate queued follow-up",
          state: "acknowledged",
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-02T04:00:01.000Z",
    });

    expect(
      [olderEntry, newerEntry].sort(
        compareCrossRunAuditCatalogChecklistItemAcknowledgment,
      ),
    ).toEqual([newerEntry, olderEntry]);
  });
});
