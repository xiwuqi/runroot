import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditCatalogReviewSignal } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileAuditCatalogReviewSignalStore,
  createPostgresAuditCatalogReviewSignalStore,
  createSqliteAuditCatalogReviewSignalStore,
  resolveAuditCatalogReviewSignalsFilePath,
} from "./catalog-review-signal-store";

function createReviewSignal(
  catalogEntryId: string,
  state: "recommended" | "reviewed" = "reviewed",
  timestamp = "2026-03-30T15:00:00.000Z",
  note = "Shared review note",
) {
  return createCrossRunAuditCatalogReviewSignal({
    catalogEntryId,
    note,
    operatorId: "ops_oncall",
    scopeId: "ops",
    state,
    timestamp,
  });
}

describe("@runroot/persistence audit catalog review signal stores", () => {
  it("persists audit catalog review signals through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresAuditCatalogReviewSignalStore({
      pool,
    });
    const secondStore = createPostgresAuditCatalogReviewSignalStore({
      pool,
    });

    try {
      await firstStore.saveCatalogReviewSignal(
        createReviewSignal("catalog_entry_postgres", "recommended"),
      );

      expect(await secondStore.listCatalogReviewSignals()).toEqual([
        createReviewSignal("catalog_entry_postgres", "recommended"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists audit catalog review signals through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-review-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteAuditCatalogReviewSignalStore({
      filePath,
    });
    const secondStore = createSqliteAuditCatalogReviewSignalStore({
      filePath,
    });

    await firstStore.saveCatalogReviewSignal(
      createReviewSignal("catalog_entry_sqlite"),
    );

    expect(await secondStore.listCatalogReviewSignals()).toEqual([
      createReviewSignal("catalog_entry_sqlite"),
    ]);
  });

  it("persists audit catalog review signals through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-review-file-"));
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogReviewSignalStore({
      filePath: resolveAuditCatalogReviewSignalsFilePath(workspacePath),
    });

    await fileStore.saveCatalogReviewSignal(
      createReviewSignal("catalog_entry_file"),
    );

    expect(await fileStore.listCatalogReviewSignals()).toEqual([
      createReviewSignal("catalog_entry_file"),
    ]);
  });

  it("overwrites and clears audit catalog review signals through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-review-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileAuditCatalogReviewSignalStore({
      filePath: resolveAuditCatalogReviewSignalsFilePath(workspacePath),
    });
    const originalEntry = createReviewSignal("catalog_entry_overwrite");
    const updatedEntry = createReviewSignal(
      "catalog_entry_overwrite",
      "recommended",
      "2026-03-30T15:00:10.000Z",
      "Prefer this shared preset",
    );

    await fileStore.saveCatalogReviewSignal(originalEntry);
    await fileStore.saveCatalogReviewSignal(updatedEntry);

    expect(
      await fileStore.getCatalogReviewSignal("catalog_entry_overwrite"),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogReviewSignals()).toEqual([updatedEntry]);
    expect(
      await fileStore.deleteCatalogReviewSignal("catalog_entry_overwrite"),
    ).toEqual(updatedEntry);
    expect(await fileStore.listCatalogReviewSignals()).toEqual([]);
  });
});
