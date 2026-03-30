import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRunrootOperatorService } from "@runroot/sdk";
import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "./server";

let app = buildServer();

afterEach(async () => {
  await app.close();
});

describe("@runroot/api", () => {
  it("returns the current health state", async () => {
    app = buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/healthz",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      project: "Runroot",
      phase: 15,
    });
  });

  it("returns package manifest integrity data", async () => {
    app = buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/manifest/packages",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();

    expect(payload.packages.length).toBeGreaterThan(5);
    expect(payload.integrity.duplicateNames).toEqual([]);
  });

  it("starts a template run and exposes its replay timeline", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
        status: string;
      };
    };

    const runResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdPayload.run.id}`,
    });
    const timelineResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdPayload.run.id}/timeline`,
    });
    const timelinePayload = timelineResponse.json() as {
      timeline: {
        entries: Array<{
          kind: string;
        }>;
      };
    };

    expect(createResponse.statusCode).toBe(201);
    expect(runResponse.statusCode).toBe(200);
    expect(createdPayload.run.status).toBe("succeeded");
    expect(
      timelinePayload.timeline.entries.map((entry) => entry.kind),
    ).toContain("run-succeeded");
  });

  it("exposes persisted tool history through the operator API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-tools-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const toolHistoryResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdPayload.run.id}/tool-history`,
    });
    const toolHistoryPayload = toolHistoryResponse.json() as {
      entries: Array<{
        executionMode?: string;
        outcome: string;
        toolName: string;
      }>;
    };

    expect(toolHistoryResponse.statusCode).toBe(200);
    expect(toolHistoryPayload.entries.map((entry) => entry.toolName)).toEqual([
      "shell.runbook",
      "shell.runbook",
    ]);
    expect(
      toolHistoryPayload.entries.every(
        (entry) =>
          entry.executionMode === "inline" && entry.outcome === "succeeded",
      ),
    ).toBe(true);
  });

  it("exposes correlated audit views through the operator API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-audit-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const auditResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdPayload.run.id}/audit`,
    });
    const auditPayload = auditResponse.json() as {
      audit: {
        entries: Array<{
          correlation: {
            runId: string;
            toolCallId?: string;
          };
          fact: {
            sourceOfTruth: string;
          };
          kind: string;
        }>;
      };
    };

    expect(auditResponse.statusCode).toBe(200);
    expect(
      auditPayload.audit.entries.some(
        (entry) =>
          entry.kind === "replay-event" &&
          entry.fact.sourceOfTruth === "runtime-event",
      ),
    ).toBe(true);
    expect(
      auditPayload.audit.entries.some(
        (entry) =>
          entry.kind === "tool-outcome" &&
          entry.fact.sourceOfTruth === "tool-history" &&
          entry.correlation.runId === createdPayload.run.id &&
          typeof entry.correlation.toolCallId === "string",
      ),
    ).toBe(true);
  });

  it("exposes cross-run audit drilldowns through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-drilldown-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const drilldownResponse = await app.inject({
      method: "GET",
      url: `/audit/drilldowns?runId=${createdPayload.run.id}`,
    });
    const drilldownPayload = drilldownResponse.json() as {
      audit: {
        isConstrained: boolean;
        results: Array<{
          matchedEntryCount: number;
          runId: string;
        }>;
        totalCount: number;
      };
    };

    expect(drilldownResponse.statusCode).toBe(200);
    expect(drilldownPayload.audit.isConstrained).toBe(true);
    expect(drilldownPayload.audit.totalCount).toBe(1);
    expect(drilldownPayload.audit.results[0]).toMatchObject({
      matchedEntryCount: expect.any(Number),
      runId: createdPayload.run.id,
    });
  });

  it("exposes linked audit navigation through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-navigation-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const navigationResponse = await app.inject({
      method: "GET",
      url: `/audit/navigation?runId=${createdPayload.run.id}`,
    });
    const navigationPayload = navigationResponse.json() as {
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
            auditView: {
              kind: string;
              runId: string;
            };
            drilldowns: Array<{
              filters: {
                runId?: string;
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

    expect(navigationResponse.statusCode).toBe(200);
    expect(navigationPayload.audit.isConstrained).toBe(true);
    expect(navigationPayload.audit.totalSummaryCount).toBe(1);
    expect(navigationPayload.audit.summaries[0]?.links.auditView).toMatchObject(
      {
        kind: "run-audit-view",
        runId: createdPayload.run.id,
      },
    );
    expect(
      navigationPayload.audit.summaries[0]?.links.drilldowns.some(
        (link) => link.filters.runId === createdPayload.run.id,
      ),
    ).toBe(true);
    expect(navigationPayload.audit.drilldowns[0]).toMatchObject({
      links: {
        auditView: {
          kind: "run-audit-view",
          runId: createdPayload.run.id,
        },
      },
      result: {
        runId: createdPayload.run.id,
      },
    });
  });

  it("saves, lists, loads, and applies saved audit views through the operator API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-saved-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        savedViewIdGenerator: () => "saved_view_api",
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Saved run detail",
        navigation: {
          drilldown: {
            runId: createdPayload.run.id,
          },
          summary: {
            definitionId: "shell-runbook-flow",
          },
        },
        refs: {
          auditViewRunId: createdPayload.run.id,
        },
      },
      url: "/audit/saved-views",
    });
    const savedViewPayload = saveResponse.json() as {
      savedView: {
        id: string;
      };
    };
    const listResponse = await app.inject({
      method: "GET",
      url: "/audit/saved-views",
    });
    const listPayload = listResponse.json() as {
      savedViews: {
        items: Array<{
          id: string;
        }>;
        totalCount: number;
      };
    };
    const getResponse = await app.inject({
      method: "GET",
      url: `/audit/saved-views/${savedViewPayload.savedView.id}`,
    });
    const applyResponse = await app.inject({
      method: "GET",
      url: `/audit/saved-views/${savedViewPayload.savedView.id}/apply`,
    });
    const applyPayload = applyResponse.json() as {
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

    expect(saveResponse.statusCode).toBe(201);
    expect(savedViewPayload.savedView.id).toBe("saved_view_api");
    expect(listResponse.statusCode).toBe(200);
    expect(listPayload.savedViews.totalCount).toBe(1);
    expect(listPayload.savedViews.items[0]?.id).toBe("saved_view_api");
    expect(getResponse.statusCode).toBe(200);
    expect(applyResponse.statusCode).toBe(200);
    expect(applyPayload.application.savedView.id).toBe("saved_view_api");
    expect(applyPayload.application.navigation.totalSummaryCount).toBe(1);
    expect(
      applyPayload.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(createdPayload.run.id);
  });

  it("rejects refs-only saved audit views through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-saved-invalid-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Refs only",
        refs: {
          auditViewRunId: "run_queued",
          drilldownRunId: "run_queued",
        },
      },
      url: "/audit/saved-views",
    });

    expect(saveResponse.statusCode).toBe(400);
    expect(saveResponse.body).toContain(
      "Saved audit views require at least one stable summary or drilldown filter",
    );
  });
});
