import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCrossRunAuditSavedView } from "@runroot/replay";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileSavedAuditViewStore,
  createPostgresSavedAuditViewStore,
  createSqliteSavedAuditViewStore,
  resolveSavedAuditViewsFilePath,
} from "./saved-view-store";

function createSavedView(
  id: string,
  overrides: {
    readonly description?: string;
    readonly timestamp?: string;
  } = {},
) {
  return createCrossRunAuditSavedView({
    description: overrides.description ?? "Queued worker follow-up",
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
    timestamp: overrides.timestamp ?? "2026-03-29T12:00:00.000Z",
  });
}

describe("@runroot/persistence saved audit view stores", () => {
  it("persists saved audit views through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresSavedAuditViewStore({
      pool,
    });
    const secondStore = createPostgresSavedAuditViewStore({
      pool,
    });

    try {
      await firstStore.saveSavedView(createSavedView("saved_postgres"));

      expect(await secondStore.listSavedViews()).toEqual([
        createSavedView("saved_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists saved audit views through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-saved-sqlite-"),
    );
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteSavedAuditViewStore({
      filePath,
    });
    const secondStore = createSqliteSavedAuditViewStore({
      filePath,
    });

    await firstStore.saveSavedView(createSavedView("saved_sqlite"));

    expect(await secondStore.listSavedViews()).toEqual([
      createSavedView("saved_sqlite"),
    ]);
  });

  it("persists saved audit views through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-saved-file-"));
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileSavedAuditViewStore({
      filePath: resolveSavedAuditViewsFilePath(workspacePath),
    });

    await fileStore.saveSavedView(createSavedView("saved_file"));

    expect(await fileStore.listSavedViews()).toEqual([
      createSavedView("saved_file"),
    ]);
  });

  it("overwrites existing saved audit views through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-saved-file-overwrite-"),
    );
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileSavedAuditViewStore({
      filePath: resolveSavedAuditViewsFilePath(workspacePath),
    });
    const originalSavedView = createSavedView("saved_file_overwrite");
    const updatedSavedView = createSavedView("saved_file_overwrite", {
      description: "Queued worker follow-up updated",
      timestamp: "2026-03-29T12:00:05.000Z",
    });

    await fileStore.saveSavedView(originalSavedView);
    await fileStore.saveSavedView(updatedSavedView);

    expect(await fileStore.getSavedView("saved_file_overwrite")).toEqual(
      updatedSavedView,
    );
    expect(await fileStore.listSavedViews()).toEqual([updatedSavedView]);
  });
});
