import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createFileToolHistoryStore,
  createPostgresToolHistoryStore,
  createSqliteToolHistoryStore,
  resolveToolHistoryFilePath,
} from "./tool-history-store";

function createEntry(callId: string) {
  return {
    attempt: 1,
    callId,
    executionMode: "inline" as const,
    finishedAt: "2026-03-28T00:00:01.000Z",
    inputSummary: "object(keys=message)",
    outcome: "succeeded" as const,
    outputSummary: "object(keys=echoed,tool)",
    runId: "run_1",
    source: "template.shell-runbook-flow",
    startedAt: "2026-03-28T00:00:00.000Z",
    stepId: "step_1",
    toolId: "builtin.echo",
    toolName: "echo",
    toolSource: "builtin",
  };
}

describe("@runroot/persistence tool history stores", () => {
  it("persists tool history through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const firstStore = createPostgresToolHistoryStore({
      pool,
    });
    const secondStore = createPostgresToolHistoryStore({
      pool,
    });

    try {
      await firstStore.save(createEntry("call_postgres"));

      expect(await secondStore.listByRunId("run_1")).toEqual([
        createEntry("call_postgres"),
      ]);
    } finally {
      await pool.end();
    }
  });

  it("persists tool history through the SQLite adapter", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-tool-sqlite-"));
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const firstStore = createSqliteToolHistoryStore({
      filePath,
    });
    const secondStore = createSqliteToolHistoryStore({
      filePath,
    });

    await firstStore.save(createEntry("call_sqlite"));

    expect(await secondStore.listByRunId("run_1")).toEqual([
      createEntry("call_sqlite"),
    ]);
  });

  it("persists tool history through the file-sidecar compatibility path", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-tool-file-"));
    const workspacePath = join(workspaceRoot, "workspace.json");
    const fileStore = createFileToolHistoryStore({
      filePath: resolveToolHistoryFilePath(workspacePath),
    });

    await fileStore.save(createEntry("call_file"));

    expect(await fileStore.listByRunId("run_1")).toEqual([
      createEntry("call_file"),
    ]);
  });
});
