import { describe, expect, it } from "vitest";

import {
  compareCrossRunAuditCatalogChecklistItemAttestation,
  createCrossRunAuditCatalogChecklistItemAttestation,
  normalizeChecklistItemAttestationItems,
} from "./checklist-item-attestation";

describe("@runroot/replay audit catalog checklist item attestation", () => {
  it("creates checklist item attestation with normalized metadata", () => {
    const attestation = createCrossRunAuditCatalogChecklistItemAttestation({
      attestationNote: " Evidence is sufficient for the queued closeout ",
      catalogEntryId: " catalog_entry_attestation ",
      items: [
        {
          item: "Validate queued follow-up",
          state: "attested",
        },
        {
          item: "Close backup handoff",
          state: "unattested",
        },
      ],
      operatorId: " ops_oncall ",
      scopeId: " ops ",
      timestamp: "2026-04-02T04:00:00.000Z",
    });

    expect(attestation).toEqual({
      attestationNote: "Evidence is sufficient for the queued closeout",
      catalogEntryId: "catalog_entry_attestation",
      createdAt: "2026-04-02T04:00:00.000Z",
      items: [
        {
          item: "Validate queued follow-up",
          state: "attested",
        },
        {
          item: "Close backup handoff",
          state: "unattested",
        },
      ],
      kind: "catalog-checklist-item-attestation",
      operatorId: "ops_oncall",
      scopeId: "ops",
      updatedAt: "2026-04-02T04:00:00.000Z",
    });
  });

  it("restricts checklist item attestation to shared evidence items", () => {
    expect(() =>
      normalizeChecklistItemAttestationItems(
        [
          {
            item: "Missing item",
            state: "attested",
          },
        ],
        ["Validate queued follow-up", "Close backup handoff"],
      ),
    ).toThrow(
      'Catalog checklist item attestation "Missing item" is not defined on the shared checklist item evidence layer.',
    );
  });

  it("sorts newer attestation entries ahead of older attestation entries", () => {
    const olderEntry = createCrossRunAuditCatalogChecklistItemAttestation({
      catalogEntryId: "catalog_entry_older",
      items: [
        {
          item: "Validate queued follow-up",
          state: "attested",
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-02T04:00:00.000Z",
    });
    const newerEntry = createCrossRunAuditCatalogChecklistItemAttestation({
      catalogEntryId: "catalog_entry_newer",
      items: [
        {
          item: "Validate queued follow-up",
          state: "attested",
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-02T04:00:01.000Z",
    });

    expect(
      [olderEntry, newerEntry].sort(
        compareCrossRunAuditCatalogChecklistItemAttestation,
      ),
    ).toEqual([newerEntry, olderEntry]);
  });
});
