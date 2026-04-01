import { describe, expect, it } from "vitest";

import {
  compareCrossRunAuditCatalogChecklistItemVerification,
  createCrossRunAuditCatalogChecklistItemVerification,
  normalizeChecklistItemVerificationItems,
} from "./checklist-item-verification";

describe("@runroot/replay audit catalog checklist item verifications", () => {
  it("creates checklist item verifications with normalized metadata", () => {
    const verification = createCrossRunAuditCatalogChecklistItemVerification({
      catalogEntryId: " catalog_entry_verification ",
      items: [
        {
          item: "Validate queued follow-up",
          state: "verified",
        },
        {
          item: "Close backup handoff",
          state: "unverified",
        },
        {
          item: "Validate queued follow-up",
          state: "verified",
        },
      ],
      operatorId: " ops_oncall ",
      scopeId: " ops ",
      timestamp: "2026-04-01T02:00:00.000Z",
      verificationNote: " Backup confirmed the closeout ",
    });

    expect(verification).toEqual({
      catalogEntryId: "catalog_entry_verification",
      createdAt: "2026-04-01T02:00:00.000Z",
      items: [
        {
          item: "Validate queued follow-up",
          state: "verified",
        },
        {
          item: "Close backup handoff",
          state: "unverified",
        },
      ],
      kind: "catalog-checklist-item-verification",
      operatorId: "ops_oncall",
      scopeId: "ops",
      updatedAt: "2026-04-01T02:00:00.000Z",
      verificationNote: "Backup confirmed the closeout",
    });
  });

  it("restricts checklist item verifications to shared resolution items", () => {
    expect(() =>
      normalizeChecklistItemVerificationItems(
        [
          {
            item: "Missing item",
            state: "verified",
          },
        ],
        ["Validate queued follow-up", "Close backup handoff"],
      ),
    ).toThrow(
      'Catalog checklist item verification "Missing item" is not defined on the shared checklist item resolution layer.',
    );
  });

  it("sorts verified entries ahead of unverified entries", () => {
    const verifiedEntry = createCrossRunAuditCatalogChecklistItemVerification({
      catalogEntryId: "catalog_entry_verified",
      items: [
        {
          item: "Validate queued follow-up",
          state: "verified",
        },
      ],
      operatorId: "ops_oncall",
      scopeId: "ops",
      timestamp: "2026-04-01T02:00:00.000Z",
    });
    const unverifiedEntry = createCrossRunAuditCatalogChecklistItemVerification(
      {
        catalogEntryId: "catalog_entry_unverified",
        items: [
          {
            item: "Validate queued follow-up",
            state: "unverified",
          },
        ],
        operatorId: "ops_oncall",
        scopeId: "ops",
        timestamp: "2026-04-01T02:00:01.000Z",
      },
    );

    expect(
      [unverifiedEntry, verifiedEntry].sort(
        compareCrossRunAuditCatalogChecklistItemVerification,
      ),
    ).toEqual([verifiedEntry, unverifiedEntry]);
  });
});
