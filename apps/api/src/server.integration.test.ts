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

  it("serves assign, list-assigned, inspect-assignment, clear-assignment, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-review-assignments-"),
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
      workerId: "worker_assignment_api",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_assignment_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_assignment_api",
        sqlitePath,
      }),
    });
    const peerApp = buildServer({
      operator: createRunrootOperatorService({
        operatorId: "ops_backup",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        sqlitePath,
      }),
    });

    try {
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

      const ownerAddress = await ownerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });
      const peerAddress = await peerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });

      const saveResponse = await fetch(`${ownerAddress}/audit/saved-views`, {
        body: JSON.stringify({
          description: "Queued worker assignment preset",
          name: "Queued worker assignment preset",
          navigation: {
            drilldown: {
              workerId: "worker_assignment_api",
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
      const publishResponse = await fetch(`${ownerAddress}/audit/catalog`, {
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
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
        {
          method: "POST",
        },
      );
      const reviewResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
        {
          body: JSON.stringify({
            note: `Handoff after inline ${inlineRun.id} and queued ${queuedRun.id}`,
            state: "recommended",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const assignmentResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
        {
          body: JSON.stringify({
            assigneeId: "ops_backup",
            handoffNote: `Queued worker ${queuedRun.id} handed to backup`,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const assignedResponse = await fetch(
        `${peerAddress}/audit/catalog/assigned`,
      );
      const inspectResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
      );
      const applyResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
      );
      const clearResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment/clear`,
        {
          method: "POST",
        },
      );
      const assignedAfterClearResponse = await fetch(
        `${peerAddress}/audit/catalog/assigned`,
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
      const assignmentPayload = (await assignmentResponse.json()) as {
        assignment: {
          assignment: {
            assigneeId: string;
            assignerId: string;
            handoffNote?: string;
            state: "assigned";
          };
        };
      };
      const assignedPayload = (await assignedResponse.json()) as {
        assigned: {
          items: Array<{
            assignment: {
              assigneeId: string;
            };
            review: {
              visibility: {
                catalogEntry: {
                  entry: {
                    id: string;
                  };
                };
              };
            };
          }>;
          totalCount: number;
        };
      };
      const inspectPayload = (await inspectResponse.json()) as {
        assignment: {
          assignment: {
            assigneeId: string;
            handoffNote?: string;
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
        assignment: {
          assignment: {
            assigneeId: string;
            state: "assigned";
          };
        };
      };
      const assignedAfterClearPayload =
        (await assignedAfterClearResponse.json()) as {
          assigned: {
            totalCount: number;
          };
        };

      expect(saveResponse.status).toBe(201);
      expect(publishResponse.status).toBe(201);
      expect(shareResponse.status).toBe(200);
      expect(sharePayload.visibility.visibility.state).toBe("shared");
      expect(reviewResponse.status).toBe(200);
      expect(reviewPayload.review.review.state).toBe("recommended");
      expect(reviewPayload.review.review.note).toContain(inlineRun.id);
      expect(assignmentResponse.status).toBe(200);
      expect(assignmentPayload.assignment.assignment).toMatchObject({
        assigneeId: "ops_backup",
        assignerId: "ops_oncall",
        handoffNote: `Queued worker ${queuedRun.id} handed to backup`,
        state: "assigned",
      });
      expect(assignedResponse.status).toBe(200);
      expect(assignedPayload.assigned.totalCount).toBe(1);
      expect(
        assignedPayload.assigned.items[0]?.review.visibility.catalogEntry.entry
          .id,
      ).toBe("catalog_entry_assignment_api");
      expect(assignedPayload.assigned.items[0]?.assignment.assigneeId).toBe(
        "ops_backup",
      );
      expect(inspectResponse.status).toBe(200);
      expect(inspectPayload.assignment.assignment.assigneeId).toBe(
        "ops_backup",
      );
      expect(inspectPayload.assignment.assignment.handoffNote).toContain(
        queuedRun.id,
      );
      expect(applyResponse.status).toBe(200);
      expect(applyPayload.application.application.savedView.id).toBe(
        "saved_view_assignment_api",
      );
      expect(
        applyPayload.application.application.navigation.totalSummaryCount,
      ).toBe(1);
      expect(
        applyPayload.application.application.navigation.drilldowns[0]?.result
          .runId,
      ).toBe(queuedRun.id);
      expect(clearResponse.status).toBe(200);
      expect(clearPayload.assignment.assignment.assigneeId).toBe("ops_backup");
      expect(clearPayload.assignment.assignment.state).toBe("assigned");
      expect(assignedAfterClearResponse.status).toBe(200);
      expect(assignedAfterClearPayload.assigned.totalCount).toBe(0);
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("serves checklist, list-checklisted, inspect-checklist, clear-checklist, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-assignment-checklists-"),
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
      workerId: "worker_checklist_api",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_checklist_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_checklist_api",
        sqlitePath,
      }),
    });
    const peerApp = buildServer({
      operator: createRunrootOperatorService({
        operatorId: "ops_backup",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        sqlitePath,
      }),
    });

    try {
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

      const ownerAddress = await ownerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });
      const peerAddress = await peerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });

      const saveResponse = await fetch(`${ownerAddress}/audit/saved-views`, {
        body: JSON.stringify({
          description: "Queued worker checklist preset",
          name: "Queued worker checklist preset",
          navigation: {
            drilldown: {
              workerId: "worker_checklist_api",
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
      const publishResponse = await fetch(`${ownerAddress}/audit/catalog`, {
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
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
        {
          method: "POST",
        },
      );
      const reviewResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
        {
          body: JSON.stringify({
            note: `Checklist ready after inline ${inlineRun.id} and queued ${queuedRun.id}`,
            state: "recommended",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const assignmentResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
        {
          body: JSON.stringify({
            assigneeId: "ops_backup",
            handoffNote: `Queued worker ${queuedRun.id} handed to backup`,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const checklistResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
        {
          body: JSON.stringify({
            items: ["Validate queued follow-up", "Close backup handoff"],
            state: "pending",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const checklistedResponse = await fetch(
        `${peerAddress}/audit/catalog/checklisted`,
      );
      const inspectResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
      );
      const applyResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
      );
      const clearResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist/clear`,
        {
          method: "POST",
        },
      );
      const checklistedAfterClearResponse = await fetch(
        `${peerAddress}/audit/catalog/checklisted`,
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
      const assignmentPayload = (await assignmentResponse.json()) as {
        assignment: {
          assignment: {
            assigneeId: string;
            handoffNote?: string;
            state: "assigned";
          };
        };
      };
      const checklistPayload = (await checklistResponse.json()) as {
        checklist: {
          assignment: {
            assignment: {
              assigneeId: string;
            };
          };
          checklist: {
            items?: readonly string[];
            state: "completed" | "pending";
          };
        };
      };
      const checklistedPayload = (await checklistedResponse.json()) as {
        checklisted: {
          items: Array<{
            assignment: {
              review: {
                visibility: {
                  catalogEntry: {
                    entry: {
                      id: string;
                    };
                  };
                };
              };
            };
            checklist: {
              items?: readonly string[];
              state: "completed" | "pending";
            };
          }>;
          totalCount: number;
        };
      };
      const inspectPayload = (await inspectResponse.json()) as {
        checklist: {
          checklist: {
            items?: readonly string[];
            state: "completed" | "pending";
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
        checklist: {
          checklist: {
            state: "completed" | "pending";
          };
        };
      };
      const checklistedAfterClearPayload =
        (await checklistedAfterClearResponse.json()) as {
          checklisted: {
            totalCount: number;
          };
        };

      expect(saveResponse.status).toBe(201);
      expect(publishResponse.status).toBe(201);
      expect(shareResponse.status).toBe(200);
      expect(sharePayload.visibility.visibility.state).toBe("shared");
      expect(reviewResponse.status).toBe(200);
      expect(reviewPayload.review.review.state).toBe("recommended");
      expect(reviewPayload.review.review.note).toContain(inlineRun.id);
      expect(assignmentResponse.status).toBe(200);
      expect(assignmentPayload.assignment.assignment.assigneeId).toBe(
        "ops_backup",
      );
      expect(assignmentPayload.assignment.assignment.handoffNote).toContain(
        queuedRun.id,
      );
      expect(checklistResponse.status).toBe(200);
      expect(checklistPayload.checklist.assignment.assignment.assigneeId).toBe(
        "ops_backup",
      );
      expect(checklistPayload.checklist.checklist.state).toBe("pending");
      expect(checklistPayload.checklist.checklist.items).toEqual([
        "Validate queued follow-up",
        "Close backup handoff",
      ]);
      expect(checklistedResponse.status).toBe(200);
      expect(checklistedPayload.checklisted.totalCount).toBe(1);
      expect(
        checklistedPayload.checklisted.items[0]?.assignment.review.visibility
          .catalogEntry.entry.id,
      ).toBe("catalog_entry_checklist_api");
      expect(checklistedPayload.checklisted.items[0]?.checklist.state).toBe(
        "pending",
      );
      expect(inspectResponse.status).toBe(200);
      expect(inspectPayload.checklist.checklist.items).toEqual([
        "Validate queued follow-up",
        "Close backup handoff",
      ]);
      expect(applyResponse.status).toBe(200);
      expect(applyPayload.application.application.savedView.id).toBe(
        "saved_view_checklist_api",
      );
      expect(
        applyPayload.application.application.navigation.totalSummaryCount,
      ).toBe(1);
      expect(
        applyPayload.application.application.navigation.drilldowns[0]?.result
          .runId,
      ).toBe(queuedRun.id);
      expect(clearResponse.status).toBe(200);
      expect(clearPayload.checklist.checklist.state).toBe("pending");
      expect(checklistedAfterClearResponse.status).toBe(200);
      expect(checklistedAfterClearPayload.checklisted.totalCount).toBe(0);
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("serves progress, list-progressed, inspect-progress, clear-progress, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-checklist-progress-"),
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
      workerId: "worker_progress_api",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_progress_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_progress_api",
        sqlitePath,
      }),
    });
    const peerApp = buildServer({
      operator: createRunrootOperatorService({
        operatorId: "ops_backup",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        sqlitePath,
      }),
    });

    try {
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

      const ownerAddress = await ownerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });
      const peerAddress = await peerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });

      const saveResponse = await fetch(`${ownerAddress}/audit/saved-views`, {
        body: JSON.stringify({
          description: "Queued worker progress preset",
          name: "Queued worker progress preset",
          navigation: {
            drilldown: {
              workerId: "worker_progress_api",
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
      const publishResponse = await fetch(`${ownerAddress}/audit/catalog`, {
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
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
        {
          method: "POST",
        },
      );
      const reviewResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
        {
          body: JSON.stringify({
            note: `Progress ready after inline ${inlineRun.id} and queued ${queuedRun.id}`,
            state: "recommended",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const assignmentResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
        {
          body: JSON.stringify({
            assigneeId: "ops_backup",
            handoffNote: `Queued worker ${queuedRun.id} handed to backup`,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const checklistResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
        {
          body: JSON.stringify({
            items: ["Validate queued follow-up", "Close backup handoff"],
            state: "pending",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const progressResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
        {
          body: JSON.stringify({
            completionNote: "Queued follow-up is almost complete",
            items: [
              {
                item: "Validate queued follow-up",
                state: "completed",
              },
              {
                item: "Close backup handoff",
                state: "pending",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const progressedResponse = await fetch(
        `${peerAddress}/audit/catalog/progressed`,
      );
      const inspectResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
      );
      const applyResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
      );
      const clearResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress/clear`,
        {
          method: "POST",
        },
      );
      const progressedAfterClearResponse = await fetch(
        `${peerAddress}/audit/catalog/progressed`,
      );
      const progressPayload = (await progressResponse.json()) as {
        progress: {
          progress: {
            completionNote?: string;
            items: Array<{
              item: string;
              state: "completed" | "pending";
            }>;
          };
        };
      };
      const progressedPayload = (await progressedResponse.json()) as {
        progressed: {
          items: Array<{
            checklist: {
              assignment: {
                review: {
                  visibility: {
                    catalogEntry: {
                      entry: {
                        id: string;
                      };
                    };
                  };
                };
              };
            };
            progress: {
              completionNote?: string;
            };
          }>;
          totalCount: number;
        };
      };
      const inspectPayload = (await inspectResponse.json()) as {
        progress: {
          progress: {
            completionNote?: string;
            items: Array<{
              item: string;
              state: "completed" | "pending";
            }>;
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
        progress: {
          progress: {
            completionNote?: string;
          };
        };
      };
      const progressedAfterClearPayload =
        (await progressedAfterClearResponse.json()) as {
          progressed: {
            totalCount: number;
          };
        };

      expect(saveResponse.status).toBe(201);
      expect(publishResponse.status).toBe(201);
      expect(shareResponse.status).toBe(200);
      expect(reviewResponse.status).toBe(200);
      expect(assignmentResponse.status).toBe(200);
      expect(checklistResponse.status).toBe(200);
      expect(progressResponse.status).toBe(200);
      expect(progressPayload.progress.progress.completionNote).toBe(
        "Queued follow-up is almost complete",
      );
      expect(progressPayload.progress.progress.items).toEqual([
        {
          item: "Validate queued follow-up",
          state: "completed",
        },
        {
          item: "Close backup handoff",
          state: "pending",
        },
      ]);
      expect(progressedResponse.status).toBe(200);
      expect(progressedPayload.progressed.totalCount).toBe(1);
      expect(
        progressedPayload.progressed.items[0]?.checklist.assignment.review
          .visibility.catalogEntry.entry.id,
      ).toBe("catalog_entry_progress_api");
      expect(inspectResponse.status).toBe(200);
      expect(inspectPayload.progress.progress.completionNote).toContain(
        "almost complete",
      );
      expect(applyResponse.status).toBe(200);
      expect(applyPayload.application.application.savedView.id).toBe(
        "saved_view_progress_api",
      );
      expect(
        applyPayload.application.application.navigation.drilldowns[0]?.result
          .runId,
      ).toBe(queuedRun.id);
      expect(clearResponse.status).toBe(200);
      expect(clearPayload.progress.progress.completionNote).toBe(
        "Queued follow-up is almost complete",
      );
      expect(progressedAfterClearResponse.status).toBe(200);
      expect(progressedAfterClearPayload.progressed.totalCount).toBe(0);
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("serves block, list-blocked, inspect-blocker, clear-blocker, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-checklist-blockers-"),
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
      workerId: "worker_blocker_api",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_blocker_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_blocker_api",
        sqlitePath,
      }),
    });
    const peerApp = buildServer({
      operator: createRunrootOperatorService({
        operatorId: "ops_backup",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        sqlitePath,
      }),
    });

    try {
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

      const ownerAddress = await ownerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });
      const peerAddress = await peerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });

      const saveResponse = await fetch(`${ownerAddress}/audit/saved-views`, {
        body: JSON.stringify({
          description: "Queued worker blocker preset",
          name: "Queued worker blocker preset",
          navigation: {
            drilldown: {
              workerId: "worker_blocker_api",
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
      const publishResponse = await fetch(`${ownerAddress}/audit/catalog`, {
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
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
        {
          method: "POST",
        },
      );
      const reviewResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
        {
          body: JSON.stringify({
            note: `Blocker ready after inline ${inlineRun.id} and queued ${queuedRun.id}`,
            state: "recommended",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const assignmentResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
        {
          body: JSON.stringify({
            assigneeId: "ops_backup",
            handoffNote: `Queued worker ${queuedRun.id} handed to backup`,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const checklistResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
        {
          body: JSON.stringify({
            items: ["Validate queued follow-up", "Close backup handoff"],
            state: "pending",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const progressResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
        {
          body: JSON.stringify({
            completionNote: "Queued follow-up is almost complete",
            items: [
              {
                item: "Validate queued follow-up",
                state: "completed",
              },
              {
                item: "Close backup handoff",
                state: "pending",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const blockerResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker`,
        {
          body: JSON.stringify({
            blockerNote: "Waiting for the overnight handoff",
            items: [
              {
                item: "Validate queued follow-up",
                state: "cleared",
              },
              {
                item: "Close backup handoff",
                state: "blocked",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const blockedResponse = await fetch(
        `${peerAddress}/audit/catalog/blocked`,
      );
      const inspectResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker`,
      );
      const applyResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
      );
      const clearResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker/clear`,
        {
          method: "POST",
        },
      );
      const blockedAfterClearResponse = await fetch(
        `${peerAddress}/audit/catalog/blocked`,
      );
      const blockerPayload = (await blockerResponse.json()) as {
        blocker: {
          blocker: {
            blockerNote?: string;
            items: Array<{
              item: string;
              state: "blocked" | "cleared";
            }>;
          };
          progress: {
            progress: {
              completionNote?: string;
            };
          };
        };
      };
      const blockedPayload = (await blockedResponse.json()) as {
        blocked: {
          items: Array<{
            blocker: {
              blockerNote?: string;
            };
            progress: {
              checklist: {
                assignment: {
                  review: {
                    visibility: {
                      catalogEntry: {
                        entry: {
                          id: string;
                        };
                      };
                    };
                  };
                };
              };
            };
          }>;
          totalCount: number;
        };
      };
      const inspectPayload = (await inspectResponse.json()) as {
        blocker: {
          blocker: {
            blockerNote?: string;
            items: Array<{
              item: string;
              state: "blocked" | "cleared";
            }>;
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
        blocker: {
          blocker: {
            blockerNote?: string;
          };
        };
      };
      const blockedAfterClearPayload =
        (await blockedAfterClearResponse.json()) as {
          blocked: {
            totalCount: number;
          };
        };

      expect(saveResponse.status).toBe(201);
      expect(publishResponse.status).toBe(201);
      expect(shareResponse.status).toBe(200);
      expect(reviewResponse.status).toBe(200);
      expect(assignmentResponse.status).toBe(200);
      expect(checklistResponse.status).toBe(200);
      expect(progressResponse.status).toBe(200);
      expect(blockerResponse.status).toBe(200);
      expect(blockerPayload.blocker.progress.progress.completionNote).toBe(
        "Queued follow-up is almost complete",
      );
      expect(blockerPayload.blocker.blocker.blockerNote).toBe(
        "Waiting for the overnight handoff",
      );
      expect(blockerPayload.blocker.blocker.items).toEqual([
        {
          item: "Validate queued follow-up",
          state: "cleared",
        },
        {
          item: "Close backup handoff",
          state: "blocked",
        },
      ]);
      expect(blockedResponse.status).toBe(200);
      expect(blockedPayload.blocked.totalCount).toBe(1);
      expect(
        blockedPayload.blocked.items[0]?.progress.checklist.assignment.review
          .visibility.catalogEntry.entry.id,
      ).toBe("catalog_entry_blocker_api");
      expect(inspectResponse.status).toBe(200);
      expect(inspectPayload.blocker.blocker.blockerNote).toContain(
        "overnight handoff",
      );
      expect(applyResponse.status).toBe(200);
      expect(applyPayload.application.application.savedView.id).toBe(
        "saved_view_blocker_api",
      );
      expect(
        applyPayload.application.application.navigation.drilldowns[0]?.result
          .runId,
      ).toBe(queuedRun.id);
      expect(clearResponse.status).toBe(200);
      expect(clearPayload.blocker.blocker.blockerNote).toBe(
        "Waiting for the overnight handoff",
      );
      expect(blockedAfterClearResponse.status).toBe(200);
      expect(blockedAfterClearPayload.blocked.totalCount).toBe(0);
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("serves resolve, list-resolved, inspect-resolution, clear-resolution, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-checklist-resolutions-"),
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
      workerId: "worker_resolution_api",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_resolution_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_resolution_api",
        sqlitePath,
      }),
    });
    const peerApp = buildServer({
      operator: createRunrootOperatorService({
        operatorId: "ops_backup",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        sqlitePath,
      }),
    });

    try {
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

      const ownerAddress = await ownerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });
      const peerAddress = await peerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });

      const saveResponse = await fetch(`${ownerAddress}/audit/saved-views`, {
        body: JSON.stringify({
          description: "Queued worker resolution preset",
          name: "Queued worker resolution preset",
          navigation: {
            drilldown: {
              workerId: "worker_resolution_api",
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
      const publishResponse = await fetch(`${ownerAddress}/audit/catalog`, {
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
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
        {
          method: "POST",
        },
      );
      const reviewResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
        {
          body: JSON.stringify({
            note: `Resolution ready after inline ${inlineRun.id} and queued ${queuedRun.id}`,
            state: "recommended",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const assignmentResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
        {
          body: JSON.stringify({
            assigneeId: "ops_backup",
            handoffNote: `Queued worker ${queuedRun.id} handed to backup`,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const checklistResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
        {
          body: JSON.stringify({
            items: ["Validate queued follow-up", "Close backup handoff"],
            state: "pending",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const progressResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
        {
          body: JSON.stringify({
            completionNote: "Queued follow-up is almost complete",
            items: [
              {
                item: "Validate queued follow-up",
                state: "completed",
              },
              {
                item: "Close backup handoff",
                state: "pending",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const blockerResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker`,
        {
          body: JSON.stringify({
            blockerNote: "Waiting for the overnight handoff",
            items: [
              {
                item: "Validate queued follow-up",
                state: "cleared",
              },
              {
                item: "Close backup handoff",
                state: "blocked",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const resolutionResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/resolution`,
        {
          body: JSON.stringify({
            resolutionNote: "Backup confirmed the follow-up closure",
            items: [
              {
                item: "Validate queued follow-up",
                state: "resolved",
              },
              {
                item: "Close backup handoff",
                state: "unresolved",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const resolvedResponse = await fetch(
        `${peerAddress}/audit/catalog/resolved`,
      );
      const inspectResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/resolution`,
      );
      const applyResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
      );
      const clearResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/resolution/clear`,
        {
          method: "POST",
        },
      );
      const resolvedAfterClearResponse = await fetch(
        `${peerAddress}/audit/catalog/resolved`,
      );
      const resolutionPayload = (await resolutionResponse.json()) as {
        resolution: {
          blocker: {
            blocker: {
              blockerNote?: string;
            };
          };
          resolution: {
            items: Array<{
              item: string;
              state: "resolved" | "unresolved";
            }>;
            resolutionNote?: string;
          };
        };
      };
      const resolvedPayload = (await resolvedResponse.json()) as {
        resolved: {
          items: Array<{
            blocker: {
              progress: {
                checklist: {
                  assignment: {
                    review: {
                      visibility: {
                        catalogEntry: {
                          entry: {
                            id: string;
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
            resolution: {
              resolutionNote?: string;
            };
          }>;
          totalCount: number;
        };
      };
      const inspectPayload = (await inspectResponse.json()) as {
        resolution: {
          resolution: {
            items: Array<{
              item: string;
              state: "resolved" | "unresolved";
            }>;
            resolutionNote?: string;
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
        resolution: {
          resolution: {
            resolutionNote?: string;
          };
        };
      };
      const resolvedAfterClearPayload =
        (await resolvedAfterClearResponse.json()) as {
          resolved: {
            totalCount: number;
          };
        };

      expect(saveResponse.status).toBe(201);
      expect(publishResponse.status).toBe(201);
      expect(shareResponse.status).toBe(200);
      expect(reviewResponse.status).toBe(200);
      expect(assignmentResponse.status).toBe(200);
      expect(checklistResponse.status).toBe(200);
      expect(progressResponse.status).toBe(200);
      expect(blockerResponse.status).toBe(200);
      expect(resolutionResponse.status).toBe(200);
      expect(resolutionPayload.resolution.blocker.blocker.blockerNote).toBe(
        "Waiting for the overnight handoff",
      );
      expect(resolutionPayload.resolution.resolution.resolutionNote).toBe(
        "Backup confirmed the follow-up closure",
      );
      expect(resolutionPayload.resolution.resolution.items).toEqual([
        {
          item: "Validate queued follow-up",
          state: "resolved",
        },
        {
          item: "Close backup handoff",
          state: "unresolved",
        },
      ]);
      expect(resolvedResponse.status).toBe(200);
      expect(resolvedPayload.resolved.totalCount).toBe(1);
      expect(
        resolvedPayload.resolved.items[0]?.blocker.progress.checklist.assignment
          .review.visibility.catalogEntry.entry.id,
      ).toBe("catalog_entry_resolution_api");
      expect(inspectResponse.status).toBe(200);
      expect(inspectPayload.resolution.resolution.resolutionNote).toContain(
        "follow-up closure",
      );
      expect(applyResponse.status).toBe(200);
      expect(applyPayload.application.application.savedView.id).toBe(
        "saved_view_resolution_api",
      );
      expect(
        applyPayload.application.application.navigation.drilldowns[0]?.result
          .runId,
      ).toBe(queuedRun.id);
      expect(clearResponse.status).toBe(200);
      expect(clearPayload.resolution.resolution.resolutionNote).toBe(
        "Backup confirmed the follow-up closure",
      );
      expect(resolvedAfterClearResponse.status).toBe(200);
      expect(resolvedAfterClearPayload.resolved.totalCount).toBe(0);
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("serves verify, list-verified, inspect-verification, clear-verification, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-checklist-verifications-"),
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
      workerId: "worker_verification_api",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_verification_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_verification_api",
        sqlitePath,
      }),
    });
    const peerApp = buildServer({
      operator: createRunrootOperatorService({
        operatorId: "ops_backup",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        sqlitePath,
      }),
    });

    try {
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

      const ownerAddress = await ownerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });
      const peerAddress = await peerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });

      const saveResponse = await fetch(`${ownerAddress}/audit/saved-views`, {
        body: JSON.stringify({
          description: "Queued worker verification preset",
          name: "Queued worker verification preset",
          navigation: {
            drilldown: {
              workerId: "worker_verification_api",
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
      const publishResponse = await fetch(`${ownerAddress}/audit/catalog`, {
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
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
        {
          method: "POST",
        },
      );
      const reviewResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
        {
          body: JSON.stringify({
            note: `Verification ready after inline ${inlineRun.id} and queued ${queuedRun.id}`,
            state: "recommended",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const assignmentResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
        {
          body: JSON.stringify({
            assigneeId: "ops_backup",
            handoffNote: `Queued worker ${queuedRun.id} handed to backup`,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const checklistResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
        {
          body: JSON.stringify({
            items: ["Validate queued follow-up", "Close backup handoff"],
            state: "pending",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const progressResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
        {
          body: JSON.stringify({
            completionNote: "Queued follow-up is almost complete",
            items: [
              {
                item: "Validate queued follow-up",
                state: "completed",
              },
              {
                item: "Close backup handoff",
                state: "pending",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const blockerResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker`,
        {
          body: JSON.stringify({
            blockerNote: "Waiting for the overnight handoff",
            items: [
              {
                item: "Validate queued follow-up",
                state: "cleared",
              },
              {
                item: "Close backup handoff",
                state: "blocked",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const resolutionResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/resolution`,
        {
          body: JSON.stringify({
            resolutionNote: "Backup confirmed the follow-up closure",
            items: [
              {
                item: "Validate queued follow-up",
                state: "resolved",
              },
              {
                item: "Close backup handoff",
                state: "unresolved",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const verificationResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/verification`,
        {
          body: JSON.stringify({
            verificationNote: "Backup verified the follow-up closure",
            items: [
              {
                item: "Validate queued follow-up",
                state: "verified",
              },
              {
                item: "Close backup handoff",
                state: "unverified",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const verifiedResponse = await fetch(
        `${peerAddress}/audit/catalog/verified`,
      );
      const inspectResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/verification`,
      );
      const applyResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
      );
      const clearResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/verification/clear`,
        {
          method: "POST",
        },
      );
      const verifiedAfterClearResponse = await fetch(
        `${peerAddress}/audit/catalog/verified`,
      );
      const verificationPayload = (await verificationResponse.json()) as {
        verification: {
          resolution: {
            resolution: {
              resolutionNote?: string;
            };
          };
          verification: {
            items: Array<{
              item: string;
              state: "verified" | "unverified";
            }>;
            verificationNote?: string;
          };
        };
      };
      const verifiedPayload = (await verifiedResponse.json()) as {
        verified: {
          items: Array<{
            resolution: {
              blocker: {
                progress: {
                  checklist: {
                    assignment: {
                      review: {
                        visibility: {
                          catalogEntry: {
                            entry: {
                              id: string;
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
            verification: {
              verificationNote?: string;
            };
          }>;
          totalCount: number;
        };
      };
      const inspectPayload = (await inspectResponse.json()) as {
        verification: {
          verification: {
            items: Array<{
              item: string;
              state: "verified" | "unverified";
            }>;
            verificationNote?: string;
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
        verification: {
          verification: {
            verificationNote?: string;
          };
        };
      };
      const verifiedAfterClearPayload =
        (await verifiedAfterClearResponse.json()) as {
          verified: {
            totalCount: number;
          };
        };

      expect(saveResponse.status).toBe(201);
      expect(publishResponse.status).toBe(201);
      expect(shareResponse.status).toBe(200);
      expect(reviewResponse.status).toBe(200);
      expect(assignmentResponse.status).toBe(200);
      expect(checklistResponse.status).toBe(200);
      expect(progressResponse.status).toBe(200);
      expect(blockerResponse.status).toBe(200);
      expect(resolutionResponse.status).toBe(200);
      expect(verificationResponse.status).toBe(200);
      expect(
        verificationPayload.verification.resolution.resolution.resolutionNote,
      ).toBe("Backup confirmed the follow-up closure");
      expect(
        verificationPayload.verification.verification.verificationNote,
      ).toBe("Backup verified the follow-up closure");
      expect(verificationPayload.verification.verification.items).toEqual([
        {
          item: "Validate queued follow-up",
          state: "verified",
        },
        {
          item: "Close backup handoff",
          state: "unverified",
        },
      ]);
      expect(verifiedResponse.status).toBe(200);
      expect(verifiedPayload.verified.totalCount).toBe(1);
      expect(
        verifiedPayload.verified.items[0]?.resolution.blocker.progress.checklist
          .assignment.review.visibility.catalogEntry.entry.id,
      ).toBe("catalog_entry_verification_api");
      expect(inspectResponse.status).toBe(200);
      expect(
        inspectPayload.verification.verification.verificationNote,
      ).toContain("verified the follow-up closure");
      expect(applyResponse.status).toBe(200);
      expect(applyPayload.application.application.savedView.id).toBe(
        "saved_view_verification_api",
      );
      expect(
        applyPayload.application.application.navigation.drilldowns[0]?.result
          .runId,
      ).toBe(queuedRun.id);
      expect(clearResponse.status).toBe(200);
      expect(clearPayload.verification.verification.verificationNote).toBe(
        "Backup verified the follow-up closure",
      );
      expect(verifiedAfterClearResponse.status).toBe(200);
      expect(verifiedAfterClearPayload.verified.totalCount).toBe(0);
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("serves record-evidence, list-evidenced, inspect-evidence, clear-evidence, and apply paths through the network API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-checklist-evidence-"),
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
      workerId: "worker_evidence_api",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_evidence_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_evidence_api",
        sqlitePath,
      }),
    });
    const peerApp = buildServer({
      operator: createRunrootOperatorService({
        operatorId: "ops_backup",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        sqlitePath,
      }),
    });

    try {
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

      const ownerAddress = await ownerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });
      const peerAddress = await peerApp.listen({
        host: "127.0.0.1",
        port: 0,
      });

      const saveResponse = await fetch(`${ownerAddress}/audit/saved-views`, {
        body: JSON.stringify({
          description: "Queued worker evidence preset",
          name: "Queued worker evidence preset",
          navigation: {
            drilldown: {
              workerId: "worker_evidence_api",
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
      const publishResponse = await fetch(`${ownerAddress}/audit/catalog`, {
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
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
        {
          method: "POST",
        },
      );
      const reviewResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
        {
          body: JSON.stringify({
            note: `Evidence ready after inline ${inlineRun.id} and queued ${queuedRun.id}`,
            state: "recommended",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const assignmentResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
        {
          body: JSON.stringify({
            assigneeId: "ops_backup",
            handoffNote: `Queued worker ${queuedRun.id} handed to backup`,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const checklistResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
        {
          body: JSON.stringify({
            items: ["Validate queued follow-up", "Close backup handoff"],
            state: "pending",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const progressResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
        {
          body: JSON.stringify({
            completionNote: "Queued follow-up is almost complete",
            items: [
              {
                item: "Validate queued follow-up",
                state: "completed",
              },
              {
                item: "Close backup handoff",
                state: "pending",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const blockerResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker`,
        {
          body: JSON.stringify({
            blockerNote: "Waiting for the overnight handoff",
            items: [
              {
                item: "Validate queued follow-up",
                state: "cleared",
              },
              {
                item: "Close backup handoff",
                state: "blocked",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const resolutionResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/resolution`,
        {
          body: JSON.stringify({
            resolutionNote: "Backup confirmed the follow-up closure",
            items: [
              {
                item: "Validate queued follow-up",
                state: "resolved",
              },
              {
                item: "Close backup handoff",
                state: "unresolved",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const verificationResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/verification`,
        {
          body: JSON.stringify({
            verificationNote: "Backup verified the follow-up closure",
            items: [
              {
                item: "Validate queued follow-up",
                state: "verified",
              },
              {
                item: "Close backup handoff",
                state: "unverified",
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const evidenceResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/evidence`,
        {
          body: JSON.stringify({
            evidenceNote: "Backup collected stable follow-up references",
            items: [
              {
                item: "Validate queued follow-up",
                references: [
                  "run://queued-follow-up",
                  "note://backup-closeout",
                ],
              },
              {
                item: "Close backup handoff",
                references: ["doc://backup-handoff"],
              },
            ],
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      const evidencedResponse = await fetch(
        `${peerAddress}/audit/catalog/evidenced`,
      );
      const inspectResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/evidence`,
      );
      const applyResponse = await fetch(
        `${peerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
      );
      const clearResponse = await fetch(
        `${ownerAddress}/audit/catalog/${publishedPayload.catalogEntry.entry.id}/evidence/clear`,
        {
          method: "POST",
        },
      );
      const evidencedAfterClearResponse = await fetch(
        `${peerAddress}/audit/catalog/evidenced`,
      );
      const evidencePayload = (await evidenceResponse.json()) as {
        evidence: {
          verification: {
            resolution: {
              resolution: {
                resolutionNote?: string;
              };
            };
            verification: {
              verificationNote?: string;
            };
          };
          evidence: {
            evidenceNote?: string;
            items: Array<{
              item: string;
              references: string[];
            }>;
          };
        };
      };
      const evidencedPayload = (await evidencedResponse.json()) as {
        evidenced: {
          items: Array<{
            evidence: {
              evidenceNote?: string;
            };
            verification: {
              resolution: {
                blocker: {
                  progress: {
                    checklist: {
                      assignment: {
                        review: {
                          visibility: {
                            catalogEntry: {
                              entry: {
                                id: string;
                              };
                            };
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          }>;
          totalCount: number;
        };
      };
      const inspectPayload = (await inspectResponse.json()) as {
        evidence: {
          evidence: {
            evidenceNote?: string;
            items: Array<{
              item: string;
              references: string[];
            }>;
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
        evidence: {
          evidence: {
            evidenceNote?: string;
          };
        };
      };
      const evidencedAfterClearPayload =
        (await evidencedAfterClearResponse.json()) as {
          evidenced: {
            totalCount: number;
          };
        };

      expect(saveResponse.status).toBe(201);
      expect(publishResponse.status).toBe(201);
      expect(shareResponse.status).toBe(200);
      expect(reviewResponse.status).toBe(200);
      expect(assignmentResponse.status).toBe(200);
      expect(checklistResponse.status).toBe(200);
      expect(progressResponse.status).toBe(200);
      expect(blockerResponse.status).toBe(200);
      expect(resolutionResponse.status).toBe(200);
      expect(verificationResponse.status).toBe(200);
      expect(evidenceResponse.status).toBe(200);
      expect(
        evidencePayload.evidence.verification.resolution.resolution
          .resolutionNote,
      ).toBe("Backup confirmed the follow-up closure");
      expect(
        evidencePayload.evidence.verification.verification.verificationNote,
      ).toBe("Backup verified the follow-up closure");
      expect(evidencePayload.evidence.evidence.evidenceNote).toBe(
        "Backup collected stable follow-up references",
      );
      expect(evidencePayload.evidence.evidence.items).toEqual([
        {
          item: "Validate queued follow-up",
          references: ["run://queued-follow-up", "note://backup-closeout"],
        },
        {
          item: "Close backup handoff",
          references: ["doc://backup-handoff"],
        },
      ]);
      expect(evidencedResponse.status).toBe(200);
      expect(evidencedPayload.evidenced.totalCount).toBe(1);
      expect(
        evidencedPayload.evidenced.items[0]?.verification.resolution.blocker
          .progress.checklist.assignment.review.visibility.catalogEntry.entry
          .id,
      ).toBe("catalog_entry_evidence_api");
      expect(inspectResponse.status).toBe(200);
      expect(inspectPayload.evidence.evidence.evidenceNote).toBe(
        "Backup collected stable follow-up references",
      );
      expect(applyResponse.status).toBe(200);
      expect(applyPayload.application.application.savedView.id).toBe(
        "saved_view_evidence_api",
      );
      expect(
        applyPayload.application.application.navigation.drilldowns[0]?.result
          .runId,
      ).toBe(queuedRun.id);
      expect(clearResponse.status).toBe(200);
      expect(clearPayload.evidence.evidence.evidenceNote).toBe(
        "Backup collected stable follow-up references",
      );
      expect(evidencedAfterClearResponse.status).toBe(200);
      expect(evidencedAfterClearPayload.evidenced.totalCount).toBe(0);
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });
});
