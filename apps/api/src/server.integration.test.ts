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
        savedViewIdGenerator: () => "saved_view_api",
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

  it("serves cross-run audit drilldowns for inline and queued runs through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-drilldown-"),
    );
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
      workerId: "worker_drilldown_api",
    });

    const inlineRun = await inlineOperator.startRun({
      input: {
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      },
      templateId: "shell-runbook-flow",
    });
    await queuedOperator.startRun({
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
        savedViewIdGenerator: () => "saved_view_api",
        sqlitePath,
      }),
    });
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const inlineResponse = await fetch(
      `${address}/audit/drilldowns?runId=${inlineRun.id}`,
    );
    const queuedResponse = await fetch(
      `${address}/audit/drilldowns?workerId=worker_drilldown_api`,
    );
    const inlinePayload = (await inlineResponse.json()) as {
      audit: {
        results: Array<{
          runId: string;
        }>;
        totalCount: number;
      };
    };
    const queuedPayload = (await queuedResponse.json()) as {
      audit: {
        results: Array<{
          identifiers: {
            workerIds: string[];
          };
        }>;
        totalMatchedEntryCount: number;
      };
    };

    expect(inlineResponse.status).toBe(200);
    expect(inlinePayload.audit.totalCount).toBe(1);
    expect(inlinePayload.audit.results[0]?.runId).toBe(inlineRun.id);
    expect(queuedResponse.status).toBe(200);
    expect(queuedPayload.audit.totalMatchedEntryCount).toBeGreaterThan(0);
    expect(queuedPayload.audit.results[0]?.identifiers.workerIds).toContain(
      "worker_drilldown_api",
    );
  });

  it("serves linked audit navigation for inline and queued runs through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-navigation-"),
    );
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
      workerId: "worker_navigation_api",
    });

    const inlineRun = await inlineOperator.startRun({
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
        savedViewIdGenerator: () => "saved_view_api",
        sqlitePath,
      }),
    });
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const unfilteredResponse = await fetch(`${address}/audit/navigation`);
    const queuedResponse = await fetch(
      `${address}/audit/navigation?executionMode=queued&workerId=worker_navigation_api`,
    );
    const unfilteredPayload = (await unfilteredResponse.json()) as {
      audit: {
        isConstrained: boolean;
        summaries: Array<{
          links: {
            auditView: {
              kind: string;
              runId: string;
            };
          };
          result: {
            runId: string;
          };
        }>;
        totalSummaryCount: number;
      };
    };
    const queuedPayload = (await queuedResponse.json()) as {
      audit: {
        drilldowns: Array<{
          links: {
            auditView: {
              kind: string;
              runId: string;
            };
          };
          result: {
            runId: string;
          };
        }>;
        isConstrained: boolean;
        summaries: Array<{
          links: {
            drilldowns: Array<{
              filters: {
                workerId?: string;
              };
            }>;
          };
          result: {
            runId: string;
          };
        }>;
        totalSummaryCount: number;
      };
    };

    expect(unfilteredResponse.status).toBe(200);
    expect(unfilteredPayload.audit.isConstrained).toBe(false);
    expect(unfilteredPayload.audit.totalSummaryCount).toBe(2);
    expect(
      unfilteredPayload.audit.summaries.map((summary) => summary.result.runId),
    ).toEqual([queuedRun.id, inlineRun.id]);
    expect(
      unfilteredPayload.audit.summaries.some(
        (summary) =>
          summary.links.auditView.kind === "run-audit-view" &&
          summary.links.auditView.runId === inlineRun.id,
      ),
    ).toBe(true);
    expect(queuedResponse.status).toBe(200);
    expect(queuedPayload.audit.isConstrained).toBe(true);
    expect(queuedPayload.audit.totalSummaryCount).toBe(1);
    expect(queuedPayload.audit.summaries[0]?.result.runId).toBe(queuedRun.id);
    expect(
      queuedPayload.audit.summaries[0]?.links.drilldowns.some(
        (link) => link.filters.workerId === "worker_navigation_api",
      ),
    ).toBe(true);
    expect(queuedPayload.audit.drilldowns[0]).toMatchObject({
      links: {
        auditView: {
          kind: "run-audit-view",
          runId: queuedRun.id,
        },
      },
      result: {
        runId: queuedRun.id,
      },
    });
  });

  it("serves saved audit view save, list, load, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-saved-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => "saved_view_api",
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
      workerId: "worker_saved_api",
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
        savedViewIdGenerator: () => "saved_view_api",
        sqlitePath,
      }),
    });
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const saveResponse = await fetch(`${address}/audit/saved-views`, {
      body: JSON.stringify({
        description: "Queued worker investigation",
        name: "Queued worker follow-up",
        navigation: {
          drilldown: {
            workerId: "worker_saved_api",
          },
          summary: {
            executionMode: "queued",
          },
        },
        refs: {
          auditViewRunId: queuedRun.id,
        },
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const savedViewPayload = (await saveResponse.json()) as {
      savedView: {
        id: string;
      };
    };
    const listResponse = await fetch(`${address}/audit/saved-views`);
    const getResponse = await fetch(
      `${address}/audit/saved-views/${savedViewPayload.savedView.id}`,
    );
    const applyResponse = await fetch(
      `${address}/audit/saved-views/${savedViewPayload.savedView.id}/apply`,
    );
    const listPayload = (await listResponse.json()) as {
      savedViews: {
        items: Array<{
          id: string;
        }>;
        totalCount: number;
      };
    };
    const getPayload = (await getResponse.json()) as {
      savedView: {
        id: string;
        refs: {
          auditViewRunId?: string;
        };
      };
    };
    const applyPayload = (await applyResponse.json()) as {
      application: {
        navigation: {
          drilldowns: Array<{
            result: {
              runId: string;
            };
          }>;
          totalSummaryCount: number;
        };
        savedView: {
          id: string;
        };
      };
    };

    expect(saveResponse.status).toBe(201);
    expect(savedViewPayload.savedView.id).toBe("saved_view_api");
    expect(listResponse.status).toBe(200);
    expect(listPayload.savedViews.totalCount).toBe(1);
    expect(listPayload.savedViews.items[0]?.id).toBe("saved_view_api");
    expect(getResponse.status).toBe(200);
    expect(getPayload.savedView.refs.auditViewRunId).toBe(queuedRun.id);
    expect(applyResponse.status).toBe(200);
    expect(applyPayload.application.savedView.id).toBe("saved_view_api");
    expect(applyPayload.application.navigation.totalSummaryCount).toBe(1);
    expect(
      applyPayload.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.id);
  });

  it("serves audit view catalog publish, share, list-visible, inspect, unshare, archive, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-catalog-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      catalogEntryIdGenerator: () => "catalog_entry_api",
      executionMode: "inline",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => "saved_view_api",
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
      workerId: "worker_catalog_api",
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
        catalogEntryIdGenerator: () => "catalog_entry_api",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_api",
        sqlitePath,
      }),
    });
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const saveResponse = await fetch(`${address}/audit/saved-views`, {
      body: JSON.stringify({
        description: "Queued worker catalog preset",
        name: "Queued worker catalog preset",
        navigation: {
          drilldown: {
            workerId: "worker_catalog_api",
          },
          summary: {
            executionMode: "queued",
          },
        },
        refs: {
          auditViewRunId: queuedRun.id,
        },
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const savedViewPayload = (await saveResponse.json()) as {
      savedView: {
        id: string;
      };
    };
    const publishResponse = await fetch(`${address}/audit/catalog`, {
      body: JSON.stringify({
        savedViewId: savedViewPayload.savedView.id,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const publishedPayload = (await publishResponse.json()) as {
      catalogEntry: {
        entry: {
          id: string;
        };
      };
    };
    const listResponse = await fetch(`${address}/audit/catalog`);
    const visibleResponse = await fetch(`${address}/audit/catalog/visible`);
    const inspectResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/visibility`,
    );
    const shareResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
      {
        method: "POST",
      },
    );
    const getResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}`,
    );
    const applyResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
    );
    const unshareResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/unshare`,
      {
        method: "POST",
      },
    );
    const archiveResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/archive`,
      {
        method: "POST",
      },
    );
    const listAfterArchiveResponse = await fetch(`${address}/audit/catalog`);
    const listPayload = (await listResponse.json()) as {
      catalog: {
        items: Array<{
          entry: {
            id: string;
          };
        }>;
        totalCount: number;
      };
    };
    const visiblePayload = (await visibleResponse.json()) as {
      visibility: {
        items: Array<{
          visibility: {
            state: "personal" | "shared";
          };
        }>;
        totalCount: number;
      };
    };
    const inspectPayload = (await inspectResponse.json()) as {
      visibility: {
        visibility: {
          state: "personal" | "shared";
        };
      };
    };
    const sharePayload = (await shareResponse.json()) as {
      visibility: {
        visibility: {
          scopeId: string;
          state: "personal" | "shared";
        };
      };
    };
    const applyPayload = (await applyResponse.json()) as {
      application: {
        application: {
          navigation: {
            drilldowns: Array<{
              result: {
                runId: string;
              };
            }>;
            totalSummaryCount: number;
          };
        };
        catalogEntry: {
          entry: {
            id: string;
          };
        };
      };
    };
    const unsharePayload = (await unshareResponse.json()) as {
      visibility: {
        visibility: {
          ownerId: string;
          state: "personal" | "shared";
        };
      };
    };
    const archivePayload = (await archiveResponse.json()) as {
      catalogEntry: {
        entry: {
          archivedAt?: string;
        };
      };
    };
    const listAfterArchivePayload = (await listAfterArchiveResponse.json()) as {
      catalog: {
        totalCount: number;
      };
    };

    expect(publishResponse.status).toBe(201);
    expect(publishedPayload.catalogEntry.entry.id).toBe("catalog_entry_api");
    expect(listResponse.status).toBe(200);
    expect(visibleResponse.status).toBe(200);
    expect(listPayload.catalog.totalCount).toBe(1);
    expect(listPayload.catalog.items[0]?.entry.id).toBe("catalog_entry_api");
    expect(visiblePayload.visibility.totalCount).toBe(1);
    expect(visiblePayload.visibility.items[0]?.visibility.state).toBe(
      "personal",
    );
    expect(inspectResponse.status).toBe(200);
    expect(inspectPayload.visibility.visibility.state).toBe("personal");
    expect(shareResponse.status).toBe(200);
    expect(sharePayload.visibility.visibility.state).toBe("shared");
    expect(sharePayload.visibility.visibility.scopeId).toBe("workspace");
    expect(getResponse.status).toBe(200);
    expect(applyResponse.status).toBe(200);
    expect(applyPayload.application.catalogEntry.entry.id).toBe(
      "catalog_entry_api",
    );
    expect(
      applyPayload.application.application.navigation.totalSummaryCount,
    ).toBe(1);
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.id);
    expect(unshareResponse.status).toBe(200);
    expect(unsharePayload.visibility.visibility.state).toBe("personal");
    expect(unsharePayload.visibility.visibility.ownerId).toBe("operator");
    expect(archiveResponse.status).toBe(200);
    expect(archivePayload.catalogEntry.entry.archivedAt).toBeTruthy();
    expect(listAfterArchiveResponse.status).toBe(200);
    expect(listAfterArchivePayload.catalog.totalCount).toBe(0);
  });

  it("serves review, list-reviewed, inspect-review, clear-review, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-review-signals-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      catalogEntryIdGenerator: () => "catalog_entry_review_api",
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => "saved_view_review_api",
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
      workerId: "worker_review_api",
    });

    const inlineRun = await inlineOperator.startRun({
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
        catalogEntryIdGenerator: () => "catalog_entry_review_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_review_api",
        sqlitePath,
      }),
    });
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const saveResponse = await fetch(`${address}/audit/saved-views`, {
      body: JSON.stringify({
        description: "Queued worker review preset",
        name: "Queued worker review preset",
        navigation: {
          drilldown: {
            workerId: "worker_review_api",
          },
          summary: {
            executionMode: "queued",
          },
        },
        refs: {
          auditViewRunId: queuedRun.id,
          drilldownRunId: queuedRun.id,
        },
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const savedViewPayload = (await saveResponse.json()) as {
      savedView: {
        id: string;
      };
    };
    const publishResponse = await fetch(`${address}/audit/catalog`, {
      body: JSON.stringify({
        savedViewId: savedViewPayload.savedView.id,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const publishedPayload = (await publishResponse.json()) as {
      catalogEntry: {
        entry: {
          id: string;
        };
      };
    };
    const shareResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
      {
        method: "POST",
      },
    );
    const reviewResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
      {
        body: JSON.stringify({
          note: `Recommended after inline ${inlineRun.id} and queued ${queuedRun.id}`,
          state: "recommended",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
    const reviewedResponse = await fetch(`${address}/audit/catalog/reviewed`);
    const inspectResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
    );
    const applyResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
    );
    const clearResponse = await fetch(
      `${address}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review/clear`,
      {
        method: "POST",
      },
    );
    const reviewedAfterClearResponse = await fetch(
      `${address}/audit/catalog/reviewed`,
    );
    const sharePayload = (await shareResponse.json()) as {
      visibility: {
        visibility: {
          state: "shared";
        };
      };
    };
    const reviewPayload = (await reviewResponse.json()) as {
      review: {
        review: {
          note?: string;
          state: "recommended" | "reviewed";
        };
      };
    };
    const reviewedPayload = (await reviewedResponse.json()) as {
      reviewed: {
        items: Array<{
          review: {
            state: "recommended" | "reviewed";
          };
          visibility: {
            catalogEntry: {
              entry: {
                id: string;
              };
              savedView: {
                refs: {
                  auditViewRunId?: string;
                };
              };
            };
          };
        }>;
        totalCount: number;
      };
    };
    const inspectPayload = (await inspectResponse.json()) as {
      review: {
        review: {
          note?: string;
          state: "recommended" | "reviewed";
        };
      };
    };
    const applyPayload = (await applyResponse.json()) as {
      application: {
        application: {
          navigation: {
            drilldowns: Array<{
              result: {
                runId: string;
              };
            }>;
            totalSummaryCount: number;
          };
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearPayload = (await clearResponse.json()) as {
      review: {
        review: {
          state: "recommended" | "reviewed";
        };
      };
    };
    const reviewedAfterClearPayload =
      (await reviewedAfterClearResponse.json()) as {
        reviewed: {
          totalCount: number;
        };
      };

    expect(saveResponse.status).toBe(201);
    expect(publishResponse.status).toBe(201);
    expect(shareResponse.status).toBe(200);
    expect(sharePayload.visibility.visibility.state).toBe("shared");
    expect(reviewResponse.status).toBe(200);
    expect(reviewPayload.review.review.state).toBe("recommended");
    expect(reviewPayload.review.review.note).toContain(queuedRun.id);
    expect(reviewedResponse.status).toBe(200);
    expect(reviewedPayload.reviewed.totalCount).toBe(1);
    expect(
      reviewedPayload.reviewed.items[0]?.visibility.catalogEntry.entry.id,
    ).toBe("catalog_entry_review_api");
    expect(
      reviewedPayload.reviewed.items[0]?.visibility.catalogEntry.savedView.refs
        .auditViewRunId,
    ).toBe(queuedRun.id);
    expect(inspectResponse.status).toBe(200);
    expect(inspectPayload.review.review.note).toContain(inlineRun.id);
    expect(applyResponse.status).toBe(200);
    expect(applyPayload.application.application.savedView.id).toBe(
      "saved_view_review_api",
    );
    expect(
      applyPayload.application.application.navigation.totalSummaryCount,
    ).toBe(1);
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.id);
    expect(clearResponse.status).toBe(200);
    expect(clearPayload.review.review.state).toBe("recommended");
    expect(reviewedAfterClearResponse.status).toBe(200);
    expect(reviewedAfterClearPayload.reviewed.totalCount).toBe(0);
  });
});
