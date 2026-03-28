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
      phase: 10,
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
});
