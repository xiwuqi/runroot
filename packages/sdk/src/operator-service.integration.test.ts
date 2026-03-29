import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMemoryLogger, createMemoryTracer } from "@runroot/observability";
import {
  createPostgresRuntimePersistence,
  createPostgresToolHistoryStore,
} from "@runroot/persistence";
import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { createRunrootOperatorService } from "./operator-service";
import { createRunrootWorkerService } from "./worker-service";

function createClock() {
  let tick = 0;

  return () => `2026-03-27T01:00:${String(tick++).padStart(2, "0")}.000Z`;
}

function createIdGenerator() {
  const counters = new Map<string, number>();

  return (prefix: "run" | "step") => {
    const nextCount = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, nextCount);

    return `${prefix}_${nextCount}`;
  };
}

describe("@runroot/sdk operator service integration", () => {
  it("runs a github issue triage workflow with approval and replay", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-sdk-"));
    const service = createRunrootOperatorService({
      approvalIdGenerator: () => "approval_1",
      idGenerator: createIdGenerator(),
      now: createClock(),
      workspacePath: join(workspaceRoot, "workspace.json"),
    });

    const run = await service.startRun({
      input: {
        issue: {
          body: "Production outage hitting multiple customers.",
          number: 101,
          title: "Production login outage",
        },
        repository: "acme/platform",
      },
      templateId: "github-issue-triage",
    });

    expect(run.status).toBe("paused");

    const pendingApprovals = await service.getPendingApprovals();

    expect(pendingApprovals).toHaveLength(1);
    expect(pendingApprovals[0]?.approval.id).toBe("approval_1");

    await service.decideApproval("approval_1", {
      actor: {
        id: "maintainer_1",
      },
      decision: "approved",
      note: "Ship it",
    });

    const resumedRun = await service.resumeRun(run.id);
    const timeline = await service.getTimeline(run.id);

    expect(resumedRun.status).toBe("succeeded");
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "waiting-for-approval",
    );
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "approval-approved",
    );
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "run-resumed",
    );
  });

  it("runs a shell runbook end to end without approval", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-sdk-shell-"));
    const logger = createMemoryLogger({
      now: () => "2026-03-27T01:10:00.000Z",
    });
    const tracer = createMemoryTracer({
      now: () => "2026-03-27T01:10:00.000Z",
    });
    const service = createRunrootOperatorService({
      idGenerator: createIdGenerator(),
      logger,
      now: createClock(),
      tracer,
      workspacePath: join(workspaceRoot, "workspace.json"),
    });

    const run = await service.startRun({
      input: {
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      },
      templateId: "shell-runbook-flow",
    });

    const timeline = await service.getTimeline(run.id);
    const toolHistory = await service.getToolHistory(run.id);
    const audit = await service.getAuditView(run.id);

    expect(run.status).toBe("succeeded");
    expect(run.output?.["execute-runbook"]).toMatchObject({
      action: "print-ready",
      exitCode: 0,
    });
    expect(toolHistory.map((entry) => entry.toolName)).toEqual([
      "shell.runbook",
      "shell.runbook",
    ]);
    expect(toolHistory.every((entry) => entry.executionMode === "inline")).toBe(
      true,
    );
    expect(tracer.spans.every((span) => span.name === "tool.invoke")).toBe(
      true,
    );
    expect(
      tracer.spans.every(
        (span) =>
          span.attributes.runId === run.id &&
          span.attributes.executionMode === "inline",
      ),
    ).toBe(true);
    expect(
      logger.records.some(
        (record) =>
          record.message === "tool invocation succeeded" &&
          record.attributes?.runId === run.id,
      ),
    ).toBe(true);
    expect(
      audit.entries.some(
        (entry) =>
          entry.kind === "replay-event" &&
          entry.fact.sourceOfTruth === "runtime-event",
      ),
    ).toBe(true);
    expect(
      audit.entries.some(
        (entry) =>
          entry.kind === "tool-outcome" &&
          entry.fact.sourceOfTruth === "tool-history" &&
          entry.correlation.runId === run.id &&
          entry.correlation.toolId === "builtin.shell.runbook",
      ),
    ).toBe(true);
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "run-succeeded",
    );
  });

  it("runs a PR review workflow with MCP-backed review output and replay", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-sdk-pr-"));
    const service = createRunrootOperatorService({
      idGenerator: createIdGenerator(),
      now: createClock(),
      workspacePath: join(workspaceRoot, "workspace.json"),
    });
    const template = service
      .listTemplates()
      .find((descriptor) => descriptor.id === "pr-review-flow");

    const run = await service.startRun({
      input: {
        pr: {
          diffSummary:
            "Adds auth middleware and a database migration for roles.",
          number: 42,
          title: "Improve RBAC role handling",
        },
        repository: "acme/platform",
      },
      templateId: "pr-review-flow",
    });
    const timeline = await service.getTimeline(run.id);

    expect(template?.toolReferences).toContain("github.pr_review");
    expect(run.status).toBe("succeeded");
    expect(run.output?.["review-pr"]).toMatchObject({
      recommendation: "request_changes",
      summary: expect.stringContaining("risky changes"),
    });
    expect(run.output?.["publish-review"]).toMatchObject({
      review: {
        recommendation: "request_changes",
        summary: expect.stringContaining("risky changes"),
      },
    });
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "run-succeeded",
    );
    expect(timeline.entries.map((entry) => entry.kind)).toContain(
      "step-completed",
    );
  });

  it("runs a shell workflow through the Postgres persistence seam", async () => {
    const memoryDatabase = newDb({
      noAstCoverageCheck: true,
    });
    const { Pool } = memoryDatabase.adapters.createPg();
    const pool = new Pool();
    const service = createRunrootOperatorService({
      idGenerator: createIdGenerator(),
      now: createClock(),
      persistence: createPostgresRuntimePersistence({
        pool,
      }),
      toolHistory: createPostgresToolHistoryStore({
        pool,
      }),
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
      const timeline = await service.getTimeline(run.id);

      expect(run.status).toBe("succeeded");
      expect(timeline.entries.map((entry) => entry.kind)).toContain(
        "run-succeeded",
      );
    } finally {
      await pool.end();
    }
  });

  it("lists cross-run audit results for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-sdk-audit-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    const inlineService = createRunrootOperatorService({
      executionMode: "inline",
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
    });
    const queuedService = createRunrootOperatorService({
      executionMode: "queued",
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
    });
    const worker = createRunrootWorkerService({
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
      workerId: "worker_audit",
    });
    const queryService = createRunrootOperatorService({
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
    });

    const inlineRun = await inlineService.startRun({
      input: {
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      },
      templateId: "shell-runbook-flow",
    });
    const queuedRun = await queuedService.startRun({
      input: {
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      },
      templateId: "shell-runbook-flow",
    });

    await worker.processNextJob();

    const results = await queryService.listAuditResults();
    const queuedResults = await queryService.listAuditResults({
      executionMode: "queued",
    });

    expect(results.totalCount).toBe(2);
    expect(results.results.map((result) => result.runId)).toEqual([
      queuedRun.id,
      inlineRun.id,
    ]);
    expect(
      results.results.find((result) => result.runId === inlineRun.id),
    ).toMatchObject({
      executionModes: ["inline"],
      runId: inlineRun.id,
    });
    expect(
      results.results.find((result) => result.runId === queuedRun.id),
    ).toMatchObject({
      dispatchJobs: [
        expect.objectContaining({
          status: "completed",
          workerId: "worker_audit",
        }),
      ],
      executionModes: ["queued"],
      runId: queuedRun.id,
      workerIds: ["worker_audit"],
    });
    expect(queuedResults.results.map((result) => result.runId)).toEqual([
      queuedRun.id,
    ]);
  });

  it("lists cross-run audit drilldowns for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-drilldown-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    const inlineService = createRunrootOperatorService({
      executionMode: "inline",
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
    });
    const queuedService = createRunrootOperatorService({
      executionMode: "queued",
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
    });
    const worker = createRunrootWorkerService({
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
      workerId: "worker_drilldown",
    });
    const queryService = createRunrootOperatorService({
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
    });

    const inlineRun = await inlineService.startRun({
      input: {
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      },
      templateId: "shell-runbook-flow",
    });
    const queuedRun = await queuedService.startRun({
      input: {
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      },
      templateId: "shell-runbook-flow",
    });

    await worker.processNextJob();

    const inlineDrilldowns = await queryService.listAuditDrilldowns({
      runId: inlineRun.id,
    });
    const queuedDrilldowns = await queryService.listAuditDrilldowns({
      workerId: "worker_drilldown",
    });

    expect(inlineDrilldowns.isConstrained).toBe(true);
    expect(inlineDrilldowns.results[0]).toMatchObject({
      runId: inlineRun.id,
    });
    expect(
      inlineDrilldowns.results[0]?.entries.some(
        (entry) =>
          entry.kind === "tool-outcome" &&
          entry.correlation.toolId === "builtin.shell.runbook",
      ),
    ).toBe(true);
    expect(queuedDrilldowns.results).toHaveLength(1);
    expect(queuedDrilldowns.results[0]).toMatchObject({
      identifiers: {
        dispatchJobIds: [expect.any(String)],
        workerIds: ["worker_drilldown"],
      },
      runId: queuedRun.id,
    });
    expect(
      queuedDrilldowns.results[0]?.entries.some(
        (entry) =>
          entry.kind === "dispatch-completed" &&
          entry.correlation.workerId === "worker_drilldown",
      ),
    ).toBe(true);
  });
});
