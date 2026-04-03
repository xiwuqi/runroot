import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogChecklistItemAttestation } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogChecklistItemAttestationStore,
  createPostgresAuditCatalogChecklistItemAttestationStore,
  createSqliteAuditCatalogChecklistItemAttestationStore,
  resolveAuditCatalogChecklistItemAttestationFilePath,
} from "./catalog-checklist-item-attestation-store";

function createAttestation(
  catalogEntryId: string,
  timestamp = "2026-04-02T04:15:00.000Z",
  attestationNote = "Operator attested that the cited evidence is sufficient",
) {
  return createCrossRunAuditCatalogChecklistItemAttestation({
    attestationNote,
    catalogEntryId,
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
    operatorId: "ops_oncall",
    scopeId: "ops",
    timestamp,
  });
}

describe("@runroot/persistence audit catalog checklist item attestation stores", () => {
  it("persists audit catalog checklist item attestation through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogChecklistItemAttestationStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogChecklistItemAttestationStore(
      {
        pool,
      },
    );

    try {
      await firstStore.saveCatalogChecklistItemAttestation(
        createAttestation("catalog_entry_postgres"),
      );

      expect(await secondStore.listCatalogChecklistItemAttestations()).toEqual([
        createAttestation("catalog_entry_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog checklist item attestation through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-attestation-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogChecklistItemAttestationStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogChecklistItemAttestationStore({
      filePath,
    });

    await firstStore.saveCatalogChecklistItemAttestation(
      createAttestation("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogChecklistItemAttestations()).toEqual([
      createAttestation("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog checklist item attestation through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-attestation-file-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemAttestationStore({
      filePath:
        resolveAuditCatalogChecklistItemAttestationFilePath(workspacePath),
    });

    await fileStore.saveCatalogChecklistItemAttestation(
      createAttestation("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogChecklistItemAttestations()).toEqual([
      createAttestation("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog checklist item attestation through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-attestation-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogChecklistItemAttestationStore({
      filePath:
        resolveAuditCatalogChecklistItemAttestationFilePath(workspacePath),
    });
    const originalEntry = createAttestation("catalog_entry_overwrite");
    const updatedEntry = createAttestation(
      "catalog_entry_overwrite",
      "2026-04-02T04:15:10.000Z",
      "Operator re-attested the evidence after the queued handoff",
    );

    await fileStore.saveCatalogChecklistItemAttestation(originalEntry);
    await fileStore.saveCatalogChecklistItemAttestation(updatedEntry);

    expect(
      await fileStore.getCatalogChecklistItemAttestation(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemAttestations()).toEqual([
      updatedEntry,
    ]);
    expect(
      await fileStore.deleteCatalogChecklistItemAttestation(
        "catalog_entry_overwrite",
      ),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogChecklistItemAttestations()).toEqual([]);
  });
});
