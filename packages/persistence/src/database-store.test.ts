import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createWorkflowRunSnapshot,
  createWorkflowStepSnapshot,
  resolveRetryPolicy,
} from "@runroot/domain";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createPostgresRuntimePersistence,
  createSqliteRuntimePersistence,
} from "./database-store";
import type { RuntimePersistence } from "./runtime-store";

function createRun(runId = "run_1") {
  const createdAt = "2026-03-27T00:00:00.000Z";
  const retryPolicy = resolveRetryPolicy({
    delayMs: 100,
    maxAttempts: 2,
  });
  const step = createWorkflowStepSnapshot({
    createdAt,
    id: "step_1",
    index: 0,
    key: "prepare",
    name: "Prepare",
    retryPolicy,
    runId,
  });

  return createWorkflowRunSnapshot({
    createdAt,
    definitionId: "workflow.prepare",
    definitionName: "Prepare workflow",
    definitionVersion: "0.1.0",
    id: runId,
    input: {
      trigger: "test",
    },
    retryPolicy,
    steps: [step],
  });
}

async function commitRunCreatedEvent(
  persistence: RuntimePersistence,
  run: ReturnType<typeof createRun>,
) {
  await persistence.commitTransition({
    events: [
      {
        name: "run.created",
        occurredAt: run.createdAt,
        payload: {
          definitionId: run.definitionId,
          status: run.status,
        },
        runId: run.id,
      },
    ],
    run,
  });
}

describe("@runroot/persistence database adapters", () => {
  it("persists runtime state through the Postgres adapter", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const run = createRun("run_postgres");
    const firstPersistence = createPostgresRuntimePersistence({
      idGenerator: (prefix) => `${prefix}_fixed`,
      pool,
    });
    const secondPersistence = createPostgresRuntimePersistence({
      idGenerator: (prefix) => `${prefix}_fixed`,
      pool,
    });

    await commitRunCreatedEvent(firstPersistence, run);

    expect(await secondPersistence.runs.get(run.id)).toEqual(run);
    expect(
      (await secondPersistence.events.listByRunId(run.id)).map(
        (event) => event.name,
      ),
    ).toEqual(["run.created"]);

    await pool.end();
  });

  it("persists runtime state through the SQLite fallback adapter", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-sqlite-"));
    const filePath = join(workspaceRoot, "runroot.sqlite");
    const run = createRun("run_sqlite");
    const firstPersistence = createSqliteRuntimePersistence({
      filePath,
      idGenerator: (prefix) => `${prefix}_fixed`,
    });
    const secondPersistence = createSqliteRuntimePersistence({
      filePath,
      idGenerator: (prefix) => `${prefix}_fixed`,
    });

    await commitRunCreatedEvent(firstPersistence, run);

    expect(await secondPersistence.runs.get(run.id)).toEqual(run);
    expect(
      (await secondPersistence.events.listByRunId(run.id)).map(
        (event) => event.name,
      ),
    ).toEqual(["run.created"]);
  });
});
