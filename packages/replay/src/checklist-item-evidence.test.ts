import { describe, expect, it } from "vitest";

import {
  compareCrossRunAuditCatalogChecklistItemEvidence,
  createCrossRunAuditCatalogChecklistItemEvidence,
  normalizeChecklistItemEvidenceItems,
} from "./checklist-item-evidence";

describe("@runroot/replay audit catalog checklist item evidence", () => {
  it("creates checklist item evidence with normalized metadata", () => {
    const evidence = createCrossRunAuditCatalogChecklistItemEvidence({
      catalogEntryId: " catalog_entry_evidence ",
      evidenceNote: " Linked tickets collected for the follow-up ",
      items: [
        {
          item: "Validate queued follow-up",
          references: [
            " ticket://ops/TKT-100 ",
            "runroot://audit/entry-1",
            "ticket://ops/TKT-100",
          ],
        },
        {
          item: "Close backup handoff",
          references: ["runroot://audit/entry-2"],
        },
      ],
      operatorId: " ops_oncall ",
      scopeId: " ops ",
      timestamp: "2026-04-02T02:00:00.000Z",
    });

    expect(evidence).toEqual({
      catalogEntryId: "catalog_entry_evidence",
      createdAt: "2026-04-02T02:00:00.000Z",
      evidenceNote: "Linked tickets collected for the follow-up",
      items: [
        {
          item: "Validate queued follow-up",
          references: ["ticket://ops/TKT-100", "runroot://audit/entry-1"],
        },
        {
          item: "Close backup handoff",
          references: ["runroot://audit/entry-2"],
        },
      ],
      kind: "catalog-checklist-item-evidence",
      operatorId: "ops_oncall",
      scopeId: "ops",
      updatedAt: "2026-04-02T02:00:00.000Z",
    });
  });

  it("restricts checklist item evidence to shared verification items", () => {
    expect(() =>
      normalizeChecklistItemEvidenceItems(
        [
          {
            item: "Missing item",
            references: ["ticket://ops/TKT-999"],
          },
        ],
        ["Validate queued follow-up", "Close backup handoff"],
      ),
    ).toThrow(
      'Catalog checklist item evidence "Missing item" is not defined on the shared checklist item verification layer.',
    );
  });

  it("sorts newer evidence entries ahead of older evidence entries", () => {
    const olderEntry = createCrossRunAuditCatalogChecklistItemEvidence({
      catalogEntryId: "catalog_entry_older",
      items: [
        {
          item: "Validate queued follow-up",
          references: ["ticket://ops/TKT-100"],
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-02T02:00:00.000Z",
    });
    const newerEntry = createCrossRunAuditCatalogChecklistItemEvidence({
      catalogEntryId: "catalog_entry_newer",
      items: [
        {
          item: "Validate queued follow-up",
          references: ["ticket://ops/TKT-101"],
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-02T02:00:01.000Z",
    });

    expect(
      [olderEntry, newerEntry].sort(
        compareCrossRunAuditCatalogChecklistItemEvidence,
      ),
    ).toEqual([newerEntry, olderEntry]);
  });
});
