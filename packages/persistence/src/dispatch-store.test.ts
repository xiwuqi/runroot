import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  createPostgresDispatchQueue,
  createSqliteDispatchQueue,
} from "./dispatch-store";

describe("@runroot/persistence dispatch queue adapters", () => {
  it("claims and completes jobs through the Postgres-backed queue", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    let dispatchId = 0;
    const queue = createPostgresDispatchQueue({
      idGenerator: () => `dispatch_postgres_${++dispatchId}`,
      pool,
    });

    try {
      await queue.enqueue({
        definitionId: "workflow.second",
        enqueuedAt: "2026-03-28T00:00:01.000Z",
        kind: "start_run",
        runId: "run_2",
      });
      await queue.enqueue({
        definitionId: "workflow.first",
        enqueuedAt: "2026-03-28T00:00:00.000Z",
        kind: "start_run",
        runId: "run_1",
      });

      const claimedJob = await queue.claimNext({
        claimedAt: "2026-03-28T00:00:02.000Z",
        workerId: "worker_1",
      });
      const completedJob = await queue.complete(
        claimedJob?.id ?? "",
        "2026-03-28T00:00:03.000Z",
      );

      expect(claimedJob?.runId).toBe("run_1");
      expect(claimedJob?.status).toBe("claimed");
      expect(completedJob?.status).toBe("completed");
      expect((await queue.list("queued")).map((job) => job.runId)).toEqual([
        "run_2",
      ]);
    } finally {
      await pool.end();
    }
  });

  it("claims and fails jobs through the SQLite-backed queue", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-queue-"));
    const queue = createSqliteDispatchQueue({
      filePath: join(workspaceRoot, "runroot.sqlite"),
      idGenerator: () => "dispatch_sqlite",
    });

    await queue.enqueue({
      definitionId: "workflow.resume",
      enqueuedAt: "2026-03-28T00:00:00.000Z",
      kind: "resume_run",
      runId: "run_1",
    });

    const claimedJob = await queue.claimNext({
      claimedAt: "2026-03-28T00:00:01.000Z",
      workerId: "worker_1",
    });
    const failedJob = await queue.fail(
      claimedJob?.id ?? "",
      "2026-03-28T00:00:02.000Z",
      "worker could not restore execution context",
    );

    expect(claimedJob?.status).toBe("claimed");
    expect(failedJob?.status).toBe("failed");
    expect(failedJob?.failureMessage).toContain("restore execution context");
    expect((await queue.listByRunId("run_1")).at(0)?.status).toBe("failed");
  });
});
