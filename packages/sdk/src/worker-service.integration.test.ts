import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMemoryLogger, createMemoryTracer } from "@runroot/observability";
import {
  createPostgresDispatchQueue,
  createPostgresRuntimePersistence,
  createPostgresToolHistoryStore,
} from "@runroot/persistence";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { createRunrootOperatorService } from "./operator-service";
import { createRunrootWorkerService } from "./worker-service";

function createClock() {
  let tick = 0;

  return () => `2026-03-28T01:00:${String(tick++).padStart(2, "0")}.000Z`;
}

function createIdGenerator() {
  const counters = new Map<string, number>();

  return (prefix: "run" | "step") => {
    const nextCount = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, nextCount);

    return `${prefix}_${nextCount}`;
  };
}

describe("@runroot/sdk worker service integration", () => {
  it("processes a queued shell run through the Postgres-backed dispatch path", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const now = createClock();
    const persistence = createPostgresRuntimePersistence({
      pool,
    });
    const dispatchQueue = createPostgresDispatchQueue({
      pool,
    });
    const service = createRunrootOperatorService({
      dispatchQueue,
      executionMode: "queued",
      idGenerator: createIdGenerator(),
      now,
      persistence,
      toolHistory: createPostgresToolHistoryStore({
        pool,
      }),
    });
    const worker = createRunrootWorkerService({
      dispatchQueue,
      idGenerator: createIdGenerator(),
      now,
      persistence,
      toolHistory: createPostgresToolHistoryStore({
        pool,
      }),
      workerId: "worker_pg",
    });

    try {
      const run = await service.startRun({
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      });

      expect(run.status).toBe("queued");

      const processedJob = await worker.processNextJob();
      const completedRun = await service.getRun(run.id);

      expect(processedJob?.status).toBe("completed");
      expect(completedRun.status).toBe("succeeded");
      expect(await dispatchQueue.list("completed")).toHaveLength(1);
    } finally {
      await pool.end();
    }
  });

  it("queues resume work after approval and completes it through the SQLite fallback path", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-worker-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const logger = createMemoryLogger({
      now: () => "2026-03-28T01:10:00.000Z",
    });
    const tracer = createMemoryTracer({
      now: () => "2026-03-28T01:10:00.000Z",
    });
    const service = createRunrootOperatorService({
      approvalIdGenerator: () => "approval_1",
      executionMode: "queued",
      idGenerator: createIdGenerator(),
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
    });
    const worker = createRunrootWorkerService({
      idGenerator: createIdGenerator(),
      logger,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
      tracer,
      workerId: "worker_sqlite",
    });

    const queuedRun = await service.startRun({
      input: {
        channel: "#ops-approvals",
        operation: "deploy staging",
        reviewerId: "ops-oncall",
        summary: "Promote build 2026.03.28-1 to staging.",
      },
      templateId: "slack-approval-flow",
    });

    expect(queuedRun.status).toBe("queued");

    const firstJob = await worker.processNextJob();
    const pausedRun = await service.getRun(queuedRun.id);
    const pendingApprovals = await service.getPendingApprovals();
    const approvalId = pendingApprovals[0]?.approval.id;

    expect(firstJob?.status).toBe("completed");
    expect(pausedRun.status).toBe("paused");
    expect(approvalId).toBeDefined();

    await service.decideApproval(approvalId ?? "", {
      actor: {
        id: "ops-oncall",
      },
      decision: "approved",
    });

    const resumedQueuedRun = await service.resumeRun(queuedRun.id);

    expect(resumedQueuedRun.status).toBe("queued");

    const secondJob = await worker.processNextJob();
    const completedRun = await service.getRun(queuedRun.id);
    const toolHistory = await service.getToolHistory(queuedRun.id);
    const timeline = await service.getTimeline(queuedRun.id);

    expect(secondJob?.status).toBe("completed");
    expect(completedRun.status).toBe("succeeded");
    expect(toolHistory).toHaveLength(2);
    expect(
      toolHistory.every(
        (entry) =>
          entry.executionMode === "queued" &&
          entry.workerId === "worker_sqlite" &&
          entry.dispatchJobId,
      ),
    ).toBe(true);
    expect(
      tracer.spans.every(
        (span) =>
          span.attributes.executionMode === "queued" &&
          span.attributes.workerId === "worker_sqlite" &&
          typeof span.attributes.dispatchJobId === "string",
      ),
    ).toBe(true);
    expect(
      logger.records.some(
        (record) =>
          record.message === "tool invocation succeeded" &&
          record.attributes?.workerId === "worker_sqlite",
      ),
    ).toBe(true);
    expect(timeline.entries.map((entry) => entry.kind)).toContain("run-queued");
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "waiting-for-approval",
    );
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "approval-approved",
    );
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "run-resumed",
    );
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "run-succeeded",
    );
  });
});
