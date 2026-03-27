import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRunrootOperatorService } from "@runroot/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "./server";

let app = buildServer();
let originalDatabaseUrl = process.env.DATABASE_URL;
let originalPersistenceDriver = process.env.RUNROOT_PERSISTENCE_DRIVER;
let originalSqlitePath = process.env.RUNROOT_SQLITE_PATH;

beforeEach(() => {
  originalDatabaseUrl = process.env.DATABASE_URL;
  originalPersistenceDriver = process.env.RUNROOT_PERSISTENCE_DRIVER;
  originalSqlitePath = process.env.RUNROOT_SQLITE_PATH;
});

afterEach(async () => {
  process.env.DATABASE_URL = originalDatabaseUrl;
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
});
