import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRunrootOperatorService } from "@runroot/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server";

let app = buildServer();
let originalDatabaseUrl = process.env.DATABASE_URL;
let originalExecutionMode = process.env.RUNROOT_EXECUTION_MODE;
let originalPersistenceDriver = process.env.RUNROOT_PERSISTENCE_DRIVER;
let originalSqlitePath = process.env.RUNROOT_SQLITE_PATH;

beforeEach(() => {
  originalDatabaseUrl = process.env.DATABASE_URL;
  originalExecutionMode = process.env.RUNROOT_EXECUTION_MODE;
  originalPersistenceDriver = process.env.RUNROOT_PERSISTENCE_DRIVER;
  originalSqlitePath = process.env.RUNROOT_SQLITE_PATH;
});

afterEach(async () => {
  process.env.DATABASE_URL = originalDatabaseUrl;
  process.env.RUNROOT_EXECUTION_MODE = originalExecutionMode;
  process.env.RUNROOT_PERSISTENCE_DRIVER = originalPersistenceDriver;
  process.env.RUNROOT_SQLITE_PATH = originalSqlitePath;
  await app.close();
});

describe("@runroot/api integration", () => {
  it("serves manifest data over a real network listener", async () => {
    app = buildServer();
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const response = await fetch(`${address}/manifest/project`);
    const payload = (await response.json()) as {
      commands: string[];
      project: {
        name: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.project.name).toBe("Runroot");
    expect(payload.commands).toContain("pnpm build");
  });

  it("runs an approval workflow through the network API and exposes replay state", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-net-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const createResponse = await fetch(`${address}/runs`, {
      body: JSON.stringify({
        input: {
          channel: "#ops-approvals",
          operation: "deploy staging",
          reviewerId: "ops-oncall",
          summary: "Promote build 2026.03.27-1 to staging.",
        },
        templateId: "slack-approval-flow",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const createdRun = (await createResponse.json()) as {
      run: {
        id: string;
        status: string;
      };
    };

    const pendingApprovalsResponse = await fetch(
      `${address}/approvals/pending`,
    );
    const pendingApprovals = (await pendingApprovalsResponse.json()) as {
      approvals: Array<{
        approval: {
          id: string;
        };
      }>;
    };
    const approvalId = pendingApprovals.approvals[0]?.approval.id;

    expect(approvalId).toBeDefined();

    await fetch(`${address}/approvals/${approvalId}/decision`, {
      body: JSON.stringify({
        actorId: "ops-oncall",
        decision: "approved",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    const resumeResponse = await fetch(
      `${address}/runs/${createdRun.run.id}/resume`,
      {
        method: "POST",
      },
    );
    const resumedRun = (await resumeResponse.json()) as {
      run: {
        status: string;
      };
    };

    const timelineResponse = await fetch(
      `${address}/runs/${createdRun.run.id}/timeline`,
    );
    const timelinePayload = (await timelineResponse.json()) as {
      timeline: {
        entries: Array<{
          kind: string;
        }>;
      };
    };

    expect(createResponse.status).toBe(201);
    expect(createdRun.run.status).toBe("paused");
    expect(resumeResponse.status).toBe(200);
    expect(resumedRun.run.status).toBe("succeeded");
    expect(
      timelinePayload.timeline.entries.map((entry) => entry.kind),
    ).toContain("waiting-for-approval");
    expect(
      timelinePayload.timeline.entries.map((entry) => entry.kind),
    ).toContain("approval-approved");
    expect(
      timelinePayload.timeline.entries.map((entry) => entry.kind),
    ).toContain("run-resumed");
  });

  it("uses the configured SQLite fallback when the API boots without an injected operator", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-sqlite-"));
    process.env.DATABASE_URL = undefined;
    process.env.RUNROOT_PERSISTENCE_DRIVER = "sqlite";
    process.env.RUNROOT_SQLITE_PATH = join(workspaceRoot, "runroot.sqlite");
    app = buildServer();
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const createResponse = await fetch(`${address}/runs`, {
      body: JSON.stringify({
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const createdRun = (await createResponse.json()) as {
      run: {
        id: string;
        status: string;
      };
    };
    const runResponse = await fetch(`${address}/runs/${createdRun.run.id}`);
    const runPayload = (await runResponse.json()) as {
      run: {
        status: string;
      };
    };

    expect(createResponse.status).toBe(201);
    expect(createdRun.run.status).toBe("succeeded");
    expect(runPayload.run.status).toBe("succeeded");
  });

  it("submits a queued run over the network and lets the worker complete it", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-queue-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");

    process.env.DATABASE_URL = undefined;
    process.env.RUNROOT_EXECUTION_MODE = "queued";
    process.env.RUNROOT_PERSISTENCE_DRIVER = "sqlite";
    process.env.RUNROOT_SQLITE_PATH = sqlitePath;
    app = buildServer();
    const worker = createRunrootOperatorService({
      executionMode: "queued",
      persistenceDriver: "sqlite",
      sqlitePath,
    });
    const workerService = (
      await import("@runroot/sdk")
    ).createRunrootWorkerService({
      persistenceDriver: "sqlite",
      sqlitePath,
      workerId: "worker_api",
    });
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const createResponse = await fetch(`${address}/runs`, {
      body: JSON.stringify({
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const createdRun = (await createResponse.json()) as {
      run: {
        id: string;
        status: string;
      };
    };

    await workerService.processNextJob();

    const runResponse = await fetch(`${address}/runs/${createdRun.run.id}`);
    const runPayload = (await runResponse.json()) as {
      run: {
        status: string;
      };
    };
    const timelineResponse = await fetch(
      `${address}/runs/${createdRun.run.id}/timeline`,
    );
    const timelinePayload = (await timelineResponse.json()) as {
      timeline: {
        entries: Array<{
          kind: string;
        }>;
      };
    };
    const toolHistoryResponse = await fetch(
      `${address}/runs/${createdRun.run.id}/tool-history`,
    );
    const auditResponse = await fetch(
      `${address}/runs/${createdRun.run.id}/audit`,
    );
    const toolHistoryPayload = (await toolHistoryResponse.json()) as {
      entries: Array<{
        executionMode?: string;
        outcome: string;
        toolName: string;
      }>;
    };
    const auditPayload = (await auditResponse.json()) as {
      audit: {
        entries: Array<{
          correlation: {
            dispatchJobId?: string;
            runId: string;
            workerId?: string;
          };
          fact: {
            sourceOfTruth: string;
          };
          kind: string;
        }>;
      };
    };

    expect(worker.getWorkspacePath()).toContain("runroot.sqlite");
    expect(createResponse.status).toBe(201);
    expect(createdRun.run.status).toBe("queued");
    expect(runPayload.run.status).toBe("succeeded");
    expect(toolHistoryPayload.entries).toHaveLength(2);
    expect(
      toolHistoryPayload.entries.every(
        (entry) =>
          entry.executionMode === "queued" && entry.outcome === "succeeded",
      ),
    ).toBe(true);
    expect(auditResponse.status).toBe(200);
    expect(
      auditPayload.audit.entries.some(
        (entry) =>
          entry.kind === "dispatch-completed" &&
          entry.fact.sourceOfTruth === "dispatch" &&
          entry.correlation.runId === createdRun.run.id &&
          typeof entry.correlation.dispatchJobId === "string" &&
          entry.correlation.workerId === "worker_api",
      ),
    ).toBe(true);
    expect(
      auditPayload.audit.entries.some(
        (entry) =>
          entry.kind === "tool-outcome" &&
          entry.fact.sourceOfTruth === "tool-history" &&
          entry.correlation.workerId === "worker_api",
      ),
    ).toBe(true);
    expect(
      timelinePayload.timeline.entries.map((entry) => entry.kind),
    ).toContain("run-queued");
    expect(
      timelinePayload.timeline.entries.map((entry) => entry.kind),
    ).toContain("run-succeeded");
  });

  it("serves cross-run audit results for inline and queued runs through the network API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-audit-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      persistenceDriver: "sqlite",
      sqlitePath,
    });
    const queuedOperator = createRunrootOperatorService({
      executionMode: "queued",
      persistenceDriver: "sqlite",
      sqlitePath,
    });
    const workerService = (
      await import("@runroot/sdk")
    ).createRunrootWorkerService({
      persistenceDriver: "sqlite",
      sqlitePath,
      workerId: "worker_audit_api",
    });

    await inlineOperator.startRun({
      input: {
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      },
      templateId: "shell-runbook-flow",
    });
    const queuedRun = await queuedOperator.startRun({
      input: {
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      },
      templateId: "shell-runbook-flow",
    });

    await workerService.processNextJob();

    app = buildServer({
      operator: createRunrootOperatorService({
        persistenceDriver: "sqlite",
        sqlitePath,
      }),
    });
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const allResultsResponse = await fetch(`${address}/audit/runs`);
    const queuedResultsResponse = await fetch(
      `${address}/audit/runs?executionMode=queued`,
    );
    const allResultsPayload = (await allResultsResponse.json()) as {
      audit: {
        results: Array<{
          dispatchJobs: Array<{
            status: string;
            workerId?: string;
          }>;
          executionModes: string[];
          runId: string;
        }>;
        totalCount: number;
      };
    };
    const queuedResultsPayload = (await queuedResultsResponse.json()) as {
      audit: {
        results: Array<{
          runId: string;
        }>;
      };
    };

    expect(allResultsResponse.status).toBe(200);
    expect(allResultsPayload.audit.totalCount).toBe(2);
    expect(
      allResultsPayload.audit.results.some((result) =>
        result.executionModes.includes("inline"),
      ),
    ).toBe(true);
    expect(
      allResultsPayload.audit.results.some(
        (result) =>
          result.runId === queuedRun.id &&
          result.executionModes.includes("queued") &&
          result.dispatchJobs.some(
            (dispatchJob) =>
              dispatchJob.status === "completed" &&
              dispatchJob.workerId === "worker_audit_api",
          ),
      ),
    ).toBe(true);
    expect(
      queuedResultsPayload.audit.results.map((result) => result.runId),
    ).toEqual([queuedRun.id]);
  });
});
