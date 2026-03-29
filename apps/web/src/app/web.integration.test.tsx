import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRunrootOperatorService } from "@runroot/sdk";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "../../../api/src/server";
import { POST as decideApproval } from "./approvals/[approvalId]/decision/route";
import ApprovalsPage from "./approvals/page";
import RunDetailPage from "./runs/[runId]/page";
import { POST as resumeRun } from "./runs/[runId]/resume/route";
import RunTimelinePage from "./runs/[runId]/timeline/page";
import RunsPage from "./runs/page";

let originalApiBaseUrl = process.env.RUNROOT_API_BASE_URL;

beforeEach(() => {
  originalApiBaseUrl = process.env.RUNROOT_API_BASE_URL;
});

afterEach(() => {
  process.env.RUNROOT_API_BASE_URL = originalApiBaseUrl;
});

describe("@runroot/web integration", () => {
  it("renders runs, approvals, and replay through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-web-"));
    const operator = createRunrootOperatorService({
      workspacePath: join(workspaceRoot, "workspace.json"),
    });
    const app = buildServer({
      operator,
    });

    try {
      const address = await app.listen({
        host: "127.0.0.1",
        port: 0,
      });
      process.env.RUNROOT_API_BASE_URL = address;

      const createResponse = await fetch(`${address}/runs`, {
        body: JSON.stringify({
          input: {
            channel: "#ops-approvals",
            operation: "deploy production",
            reviewerId: "ops-oncall",
            summary: "Promote build 2026.03.27-6 to production.",
          },
          templateId: "slack-approval-flow",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const createdPayload = (await createResponse.json()) as {
        run: {
          id: string;
        };
      };

      const runsMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({}),
        }),
      );
      expect(runsMarkup).toContain("Cross-run audit queries");
      expect(runsMarkup).toContain("Cross-run audit drilldowns");
      expect(runsMarkup).toContain(createdPayload.run.id);
      expect(runsMarkup).toContain("Slack approval flow");

      const approvalsMarkup = renderToStaticMarkup(
        await ApprovalsPage({
          searchParams: Promise.resolve({}),
        }),
      );
      expect(approvalsMarkup).toContain("Approval queue");

      const pendingResponse = await fetch(`${address}/approvals/pending`);
      const pendingPayload = (await pendingResponse.json()) as {
        approvals: Array<{
          approval: {
            id: string;
          };
        }>;
      };
      const approvalId = pendingPayload.approvals[0]?.approval.id;

      expect(approvalId).toBeDefined();
      if (!approvalId) {
        throw new Error("Expected a pending approval ID from the API.");
      }

      const approvalForm = new FormData();
      approvalForm.set("decision", "approved");
      approvalForm.set("returnTo", "/approvals");

      const decisionResponse = await decideApproval(
        new Request(`http://localhost/approvals/${approvalId}/decision`, {
          body: approvalForm,
          method: "POST",
        }),
        {
          params: Promise.resolve({
            approvalId,
          }),
        },
      );
      expect(decisionResponse.status).toBe(303);

      const resumeForm = new FormData();
      resumeForm.set("returnTo", `/runs/${createdPayload.run.id}`);

      const resumeResponse = await resumeRun(
        new Request(`http://localhost/runs/${createdPayload.run.id}/resume`, {
          body: resumeForm,
          method: "POST",
        }),
        {
          params: Promise.resolve({
            runId: createdPayload.run.id,
          }),
        },
      );
      expect(resumeResponse.status).toBe(303);

      const detailMarkup = renderToStaticMarkup(
        await RunDetailPage({
          params: Promise.resolve({
            runId: createdPayload.run.id,
          }),
          searchParams: Promise.resolve({}),
        }),
      );
      const timelineMarkup = renderToStaticMarkup(
        await RunTimelinePage({
          params: Promise.resolve({
            runId: createdPayload.run.id,
          }),
          searchParams: Promise.resolve({}),
        }),
      );

      expect(detailMarkup).toContain("succeeded");
      expect(detailMarkup).toContain("Audit view");
      expect(detailMarkup).toContain("Tool history");
      expect(detailMarkup).toContain("slack.notify");
      expect(detailMarkup).toContain("source runtime-event");
      expect(timelineMarkup).toContain("waiting-for-approval");
      expect(timelineMarkup).toContain("approval-approved");
      expect(timelineMarkup).toContain("run-resumed");
    } finally {
      await app.close();
    }
  });

  it("renders identifier-driven drilldowns through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-drilldown-"),
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
      workerId: "worker_web_drilldown",
    });
    const app = buildServer({
      operator: createRunrootOperatorService({
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
      await queuedOperator.startRun({
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      });

      await workerService.processNextJob();

      const address = await app.listen({
        host: "127.0.0.1",
        port: 0,
      });
      process.env.RUNROOT_API_BASE_URL = address;

      const drilldownMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            drilldownRunId: inlineRun.id,
          }),
        }),
      );

      expect(drilldownMarkup).toContain("Cross-run audit drilldowns");
      expect(drilldownMarkup).toContain(inlineRun.id);
      expect(drilldownMarkup).toContain("shell.runbook");
    } finally {
      await app.close();
    }
  });
});
