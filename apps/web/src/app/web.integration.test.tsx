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
import { POST as mutateCatalog } from "./runs/catalog/route";
import RunsPage from "./runs/page";
import { POST as saveSavedView } from "./runs/saved-views/route";

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
      expect(runsMarkup).toContain("Cross-run audit navigation");
      expect(runsMarkup).toContain("Provide at least one stable identifier");
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

  it("renders linked audit navigation through the existing API surface", async () => {
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
      const queuedRun = await queuedOperator.startRun({
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

      expect(drilldownMarkup).toContain("Cross-run audit navigation");
      expect(drilldownMarkup).toContain(inlineRun.id);
      expect(drilldownMarkup).toContain(queuedRun.id);
      expect(drilldownMarkup).toContain("shell.runbook");
      expect(drilldownMarkup).toContain("Run audit view");
    } finally {
      await app.close();
    }
  });

  it("renders and applies saved audit views through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-web-saved-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => "saved_view_web",
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
      workerId: "worker_web_saved",
    });
    const app = buildServer({
      operator: createRunrootOperatorService({
        persistenceDriver: "sqlite",
        sqlitePath,
      }),
    });

    try {
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

      const address = await app.listen({
        host: "127.0.0.1",
        port: 0,
      });
      process.env.RUNROOT_API_BASE_URL = address;

      const saveForm = new FormData();
      saveForm.set("name", "Queued worker follow-up");
      saveForm.set("description", "Saved queued worker investigation");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_saved");
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );
      const location = saveResponse.headers.get("Location");

      expect(saveResponse.status).toBe(303);
      expect(location).toContain("savedViewId=saved_view_web");

      const savedViewMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            savedViewId: "saved_view_web",
          }),
        }),
      );

      expect(savedViewMarkup).toContain("Saved audit views");
      expect(savedViewMarkup).toContain("Queued worker follow-up");
      expect(savedViewMarkup).toContain("Currently applied");
      expect(savedViewMarkup).toContain(queuedRun.id);
    } finally {
      await app.close();
    }
  });

  it("renders, publishes, shares, unshares, archives, and applies audit view catalogs through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-web-catalog-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      catalogEntryIdGenerator: () => "catalog_entry_web",
      executionMode: "inline",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => "saved_view_web",
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
      workerId: "worker_web_catalog",
    });
    const app = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_web",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_web",
        sqlitePath,
      }),
    });

    try {
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

      const address = await app.listen({
        host: "127.0.0.1",
        port: 0,
      });
      process.env.RUNROOT_API_BASE_URL = address;

      const saveForm = new FormData();
      saveForm.set("name", "Queued worker follow-up");
      saveForm.set("description", "Saved queued worker investigation");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_catalog");
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );
      const savedViewLocation = saveResponse.headers.get("Location");

      expect(saveResponse.status).toBe(303);
      expect(savedViewLocation).toContain("savedViewId=saved_view_web");

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );
      const publishLocation = publishResponse.headers.get("Location");

      expect(publishResponse.status).toBe(303);
      expect(publishLocation).toContain("catalogEntryId=catalog_entry_web");

      const catalogMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_web",
          }),
        }),
      );

      expect(catalogMarkup).toContain("Catalog visibility");
      expect(catalogMarkup).toContain("Queued worker follow-up");
      expect(catalogMarkup).toContain("Currently applied");
      expect(catalogMarkup).toContain("personal");
      expect(catalogMarkup).toContain(queuedRun.id);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const sharedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_web",
          }),
        }),
      );

      expect(sharedMarkup).toContain("shared");
      expect(sharedMarkup).toContain("Make personal");

      const unshareForm = new FormData();
      unshareForm.set("catalogEntryId", "catalog_entry_web");
      unshareForm.set("intent", "unshare");

      const unshareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: unshareForm,
          method: "POST",
        }),
      );

      expect(unshareResponse.status).toBe(303);

      const unsharedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_web",
          }),
        }),
      );

      expect(unsharedMarkup).toContain("personal");

      const archiveForm = new FormData();
      archiveForm.set("catalogEntryId", "catalog_entry_web");
      archiveForm.set("intent", "archive");

      const archiveResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: archiveForm,
          method: "POST",
        }),
      );

      expect(archiveResponse.status).toBe(303);

      const archivedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({}),
        }),
      );

      expect(archivedMarkup).toContain("Catalog visibility");
      expect(archivedMarkup).not.toContain("catalog_entry_web");
    } finally {
      await app.close();
    }
  });

  it("renders, reviews, clears, and reapplies reviewed presets through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-review-signals-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      catalogEntryIdGenerator: () => "catalog_entry_review_web",
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => "saved_view_review_web",
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
      workerId: "worker_web_review",
    });
    const app = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_review_web",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_review_web",
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

      const address = await app.listen({
        host: "127.0.0.1",
        port: 0,
      });
      process.env.RUNROOT_API_BASE_URL = address;

      const saveForm = new FormData();
      saveForm.set("name", "Queued review preset");
      saveForm.set("description", "Saved queued worker review preset");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_review");
      saveForm.set("auditViewRunId", queuedRun.id);
      saveForm.set("drilldownRunId", queuedRun.id);
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );

      expect(saveResponse.status).toBe(303);

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_review_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );

      expect(publishResponse.status).toBe(303);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_review_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const reviewForm = new FormData();
      reviewForm.set("catalogEntryId", "catalog_entry_review_web");
      reviewForm.set("intent", "review");
      reviewForm.set("note", `Recommended after inline ${inlineRun.id}`);
      reviewForm.set("reviewState", "recommended");
      reviewForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_review_web",
      );

      const reviewResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: reviewForm,
          method: "POST",
        }),
      );

      expect(reviewResponse.status).toBe(303);

      const reviewedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_review_web",
          }),
        }),
      );

      expect(reviewedMarkup).toContain("Catalog review signals");
      expect(reviewedMarkup).toContain("Queued review preset");
      expect(reviewedMarkup).toContain("recommended");
      expect(reviewedMarkup).toContain(inlineRun.id);
      expect(reviewedMarkup).toContain(queuedRun.id);
      expect(reviewedMarkup).toContain("Apply reviewed preset");
      expect(reviewedMarkup).toContain("Currently applied");

      const clearForm = new FormData();
      clearForm.set("catalogEntryId", "catalog_entry_review_web");
      clearForm.set("intent", "clear-review");
      clearForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_review_web",
      );

      const clearResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearForm,
          method: "POST",
        }),
      );

      expect(clearResponse.status).toBe(303);

      const clearedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_review_web",
          }),
        }),
      );

      expect(clearedMarkup).toContain("Catalog review signals");
      expect(clearedMarkup).toContain("No review signals yet");
      expect(clearedMarkup).not.toContain(
        `Recommended after inline ${inlineRun.id}`,
      );
    } finally {
      await app.close();
    }
  });

  it("renders, assigns, clears, and reapplies reviewed presets through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-review-assignments-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
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
      workerId: "worker_web_assignment",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_assignment_web",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_assignment_web",
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

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const saveForm = new FormData();
      saveForm.set("name", "Queued assignment preset");
      saveForm.set("description", "Saved queued worker assignment preset");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_assignment");
      saveForm.set("auditViewRunId", queuedRun.id);
      saveForm.set("drilldownRunId", queuedRun.id);
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );

      expect(saveResponse.status).toBe(303);

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_assignment_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );

      expect(publishResponse.status).toBe(303);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_assignment_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const reviewForm = new FormData();
      reviewForm.set("catalogEntryId", "catalog_entry_assignment_web");
      reviewForm.set("intent", "review");
      reviewForm.set("note", `Reviewed after inline ${inlineRun.id}`);
      reviewForm.set("reviewState", "recommended");
      reviewForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_assignment_web",
      );

      const reviewResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: reviewForm,
          method: "POST",
        }),
      );

      expect(reviewResponse.status).toBe(303);

      const assignForm = new FormData();
      assignForm.set("catalogEntryId", "catalog_entry_assignment_web");
      assignForm.set("intent", "assign");
      assignForm.set("assigneeId", "ops_backup");
      assignForm.set(
        "handoffNote",
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      assignForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_assignment_web",
      );

      const assignResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: assignForm,
          method: "POST",
        }),
      );

      expect(assignResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const assignedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_assignment_web",
          }),
        }),
      );

      expect(assignedMarkup).toContain("Catalog review assignments");
      expect(assignedMarkup).toContain("Queued assignment preset");
      expect(assignedMarkup).toContain("ops_backup");
      expect(assignedMarkup).toContain(
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      expect(assignedMarkup).toContain(`Reviewed after inline ${inlineRun.id}`);
      expect(assignedMarkup).toContain("Apply assigned preset");
      expect(assignedMarkup).toContain("Currently applied");

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearForm = new FormData();
      clearForm.set("catalogEntryId", "catalog_entry_assignment_web");
      clearForm.set("intent", "clear-assignment");
      clearForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_assignment_web",
      );

      const clearResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearForm,
          method: "POST",
        }),
      );

      expect(clearResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_assignment_web",
          }),
        }),
      );

      expect(clearedMarkup).toContain("Catalog review assignments");
      expect(clearedMarkup).toContain("No review assignments yet");
      expect(clearedMarkup).not.toContain(
        `Queued worker ${queuedRun.id} handed to backup`,
      );
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("renders, checklists, clears, and reapplies assigned presets through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-assignment-checklists-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
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
      workerId: "worker_web_checklist",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_checklist_web",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_checklist_web",
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

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const saveForm = new FormData();
      saveForm.set("name", "Queued checklist preset");
      saveForm.set("description", "Saved queued worker checklist preset");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_checklist");
      saveForm.set("auditViewRunId", queuedRun.id);
      saveForm.set("drilldownRunId", queuedRun.id);
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );

      expect(saveResponse.status).toBe(303);

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_checklist_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );

      expect(publishResponse.status).toBe(303);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_checklist_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const reviewForm = new FormData();
      reviewForm.set("catalogEntryId", "catalog_entry_checklist_web");
      reviewForm.set("intent", "review");
      reviewForm.set("note", `Checklist ready after inline ${inlineRun.id}`);
      reviewForm.set("reviewState", "recommended");
      reviewForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_checklist_web",
      );

      const reviewResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: reviewForm,
          method: "POST",
        }),
      );

      expect(reviewResponse.status).toBe(303);

      const assignForm = new FormData();
      assignForm.set("catalogEntryId", "catalog_entry_checklist_web");
      assignForm.set("intent", "assign");
      assignForm.set("assigneeId", "ops_backup");
      assignForm.set(
        "handoffNote",
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      assignForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_checklist_web",
      );

      const assignResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: assignForm,
          method: "POST",
        }),
      );

      expect(assignResponse.status).toBe(303);

      const checklistForm = new FormData();
      checklistForm.set("catalogEntryId", "catalog_entry_checklist_web");
      checklistForm.set("intent", "checklist");
      checklistForm.set("checklistState", "pending");
      checklistForm.set(
        "checklistItems",
        "Validate queued follow-up\nClose backup handoff",
      );
      checklistForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_checklist_web",
      );

      const checklistResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: checklistForm,
          method: "POST",
        }),
      );

      expect(checklistResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const checklistedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_checklist_web",
          }),
        }),
      );

      expect(checklistedMarkup).toContain("Assignment checklists");
      expect(checklistedMarkup).toContain("Queued checklist preset");
      expect(checklistedMarkup).toContain("pending");
      expect(checklistedMarkup).toContain("Validate queued follow-up");
      expect(checklistedMarkup).toContain("Close backup handoff");
      expect(checklistedMarkup).toContain("Apply checklisted preset");
      expect(checklistedMarkup).toContain(
        `Checklist ready after inline ${inlineRun.id}`,
      );
      expect(checklistedMarkup).toContain(
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      expect(checklistedMarkup).toContain("Currently applied");

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearForm = new FormData();
      clearForm.set("catalogEntryId", "catalog_entry_checklist_web");
      clearForm.set("intent", "clear-checklist");
      clearForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_checklist_web",
      );

      const clearResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearForm,
          method: "POST",
        }),
      );

      expect(clearResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_checklist_web",
          }),
        }),
      );

      expect(clearedMarkup).toContain("Assignment checklists");
      expect(clearedMarkup).toContain("No assignment checklists yet");
      expect(clearedMarkup).not.toContain("Validate queued follow-up");
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("renders, progresses, clears, and reapplies checklist item progress through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-checklist-progress-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
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
      workerId: "worker_web_progress",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_progress_web",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_progress_web",
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

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const saveForm = new FormData();
      saveForm.set("name", "Queued progress preset");
      saveForm.set("description", "Saved queued worker progress preset");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_progress");
      saveForm.set("auditViewRunId", queuedRun.id);
      saveForm.set("drilldownRunId", queuedRun.id);
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );

      expect(saveResponse.status).toBe(303);

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_progress_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );

      expect(publishResponse.status).toBe(303);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_progress_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const reviewForm = new FormData();
      reviewForm.set("catalogEntryId", "catalog_entry_progress_web");
      reviewForm.set("intent", "review");
      reviewForm.set("note", `Progress ready after inline ${inlineRun.id}`);
      reviewForm.set("reviewState", "recommended");
      reviewForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_progress_web",
      );

      const reviewResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: reviewForm,
          method: "POST",
        }),
      );

      expect(reviewResponse.status).toBe(303);

      const assignForm = new FormData();
      assignForm.set("catalogEntryId", "catalog_entry_progress_web");
      assignForm.set("intent", "assign");
      assignForm.set("assigneeId", "ops_backup");
      assignForm.set(
        "handoffNote",
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      assignForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_progress_web",
      );

      const assignResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: assignForm,
          method: "POST",
        }),
      );

      expect(assignResponse.status).toBe(303);

      const checklistForm = new FormData();
      checklistForm.set("catalogEntryId", "catalog_entry_progress_web");
      checklistForm.set("intent", "checklist");
      checklistForm.set("checklistState", "pending");
      checklistForm.set(
        "checklistItems",
        "Validate queued follow-up\nClose backup handoff",
      );
      checklistForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_progress_web",
      );

      const checklistResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: checklistForm,
          method: "POST",
        }),
      );

      expect(checklistResponse.status).toBe(303);

      const progressForm = new FormData();
      progressForm.set("catalogEntryId", "catalog_entry_progress_web");
      progressForm.set("intent", "progress");
      progressForm.set(
        "progressItems",
        "completed: Validate queued follow-up\npending: Close backup handoff",
      );
      progressForm.set("completionNote", "Queued follow-up is almost complete");
      progressForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_progress_web",
      );

      const progressResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: progressForm,
          method: "POST",
        }),
      );

      expect(progressResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const progressedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_progress_web",
          }),
        }),
      );

      expect(progressedMarkup).toContain("Checklist item progress");
      expect(progressedMarkup).toContain("Queued progress preset");
      expect(progressedMarkup).toContain("1/2 completed");
      expect(progressedMarkup).toContain("Validate queued follow-up");
      expect(progressedMarkup).toContain("Close backup handoff");
      expect(progressedMarkup).toContain("Queued follow-up is almost complete");
      expect(progressedMarkup).toContain("Apply progressed preset");
      expect(progressedMarkup).toContain(
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      expect(progressedMarkup).toContain("Currently applied");

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearForm = new FormData();
      clearForm.set("catalogEntryId", "catalog_entry_progress_web");
      clearForm.set("intent", "clear-progress");
      clearForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_progress_web",
      );

      const clearResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearForm,
          method: "POST",
        }),
      );

      expect(clearResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_progress_web",
          }),
        }),
      );

      expect(clearedMarkup).toContain("Checklist item progress");
      expect(clearedMarkup).toContain("No checklist item progress yet");
      expect(clearedMarkup).not.toContain(
        "Queued follow-up is almost complete",
      );
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("renders, blocks, clears, and reapplies checklist item blockers through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-checklist-blockers-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
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
      workerId: "worker_web_blocker",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_blocker_web",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_blocker_web",
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

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const saveForm = new FormData();
      saveForm.set("name", "Queued blocker preset");
      saveForm.set("description", "Saved queued worker blocker preset");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_blocker");
      saveForm.set("auditViewRunId", queuedRun.id);
      saveForm.set("drilldownRunId", queuedRun.id);
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );

      expect(saveResponse.status).toBe(303);

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_blocker_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );

      expect(publishResponse.status).toBe(303);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_blocker_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const reviewForm = new FormData();
      reviewForm.set("catalogEntryId", "catalog_entry_blocker_web");
      reviewForm.set("intent", "review");
      reviewForm.set("note", `Blocker ready after inline ${inlineRun.id}`);
      reviewForm.set("reviewState", "recommended");
      reviewForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_blocker_web",
      );

      const reviewResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: reviewForm,
          method: "POST",
        }),
      );

      expect(reviewResponse.status).toBe(303);

      const assignForm = new FormData();
      assignForm.set("catalogEntryId", "catalog_entry_blocker_web");
      assignForm.set("intent", "assign");
      assignForm.set("assigneeId", "ops_backup");
      assignForm.set(
        "handoffNote",
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      assignForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_blocker_web",
      );

      const assignResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: assignForm,
          method: "POST",
        }),
      );

      expect(assignResponse.status).toBe(303);

      const checklistForm = new FormData();
      checklistForm.set("catalogEntryId", "catalog_entry_blocker_web");
      checklistForm.set("intent", "checklist");
      checklistForm.set("checklistState", "pending");
      checklistForm.set(
        "checklistItems",
        "Validate queued follow-up\nClose backup handoff",
      );
      checklistForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_blocker_web",
      );

      const checklistResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: checklistForm,
          method: "POST",
        }),
      );

      expect(checklistResponse.status).toBe(303);

      const progressForm = new FormData();
      progressForm.set("catalogEntryId", "catalog_entry_blocker_web");
      progressForm.set("intent", "progress");
      progressForm.set(
        "progressItems",
        "completed: Validate queued follow-up\npending: Close backup handoff",
      );
      progressForm.set("completionNote", "Queued follow-up is almost complete");
      progressForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_blocker_web",
      );

      const progressResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: progressForm,
          method: "POST",
        }),
      );

      expect(progressResponse.status).toBe(303);

      const blockerForm = new FormData();
      blockerForm.set("catalogEntryId", "catalog_entry_blocker_web");
      blockerForm.set("intent", "block");
      blockerForm.set(
        "blockerItems",
        "cleared: Validate queued follow-up\nblocked: Close backup handoff",
      );
      blockerForm.set("blockerNote", "Waiting for the overnight handoff");
      blockerForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_blocker_web",
      );

      const blockerResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: blockerForm,
          method: "POST",
        }),
      );

      expect(blockerResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const blockedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_blocker_web",
          }),
        }),
      );

      expect(blockedMarkup).toContain("Checklist item blockers");
      expect(blockedMarkup).toContain("Queued blocker preset");
      expect(blockedMarkup).toContain("1/2 blocked");
      expect(blockedMarkup).toContain("Validate queued follow-up");
      expect(blockedMarkup).toContain("Close backup handoff");
      expect(blockedMarkup).toContain("Waiting for the overnight handoff");
      expect(blockedMarkup).toContain("Apply blocked preset");
      expect(blockedMarkup).toContain(
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      expect(blockedMarkup).toContain("Currently applied");

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearForm = new FormData();
      clearForm.set("catalogEntryId", "catalog_entry_blocker_web");
      clearForm.set("intent", "clear-blocker");
      clearForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_blocker_web",
      );

      const clearResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearForm,
          method: "POST",
        }),
      );

      expect(clearResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_blocker_web",
          }),
        }),
      );

      expect(clearedMarkup).toContain("Checklist item blockers");
      expect(clearedMarkup).toContain("No checklist item blockers yet");
      expect(clearedMarkup).not.toContain("Waiting for the overnight handoff");
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("renders, resolves, clears, and reapplies checklist item resolutions through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-checklist-resolutions-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
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
      workerId: "worker_web_resolution",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_resolution_web",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_resolution_web",
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

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const saveForm = new FormData();
      saveForm.set("name", "Queued resolution preset");
      saveForm.set("description", "Saved queued worker resolution preset");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_resolution");
      saveForm.set("auditViewRunId", queuedRun.id);
      saveForm.set("drilldownRunId", queuedRun.id);
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );

      expect(saveResponse.status).toBe(303);

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_resolution_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );

      expect(publishResponse.status).toBe(303);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_resolution_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const reviewForm = new FormData();
      reviewForm.set("catalogEntryId", "catalog_entry_resolution_web");
      reviewForm.set("intent", "review");
      reviewForm.set("note", `Resolution ready after inline ${inlineRun.id}`);
      reviewForm.set("reviewState", "recommended");
      reviewForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_resolution_web",
      );

      const reviewResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: reviewForm,
          method: "POST",
        }),
      );

      expect(reviewResponse.status).toBe(303);

      const assignForm = new FormData();
      assignForm.set("catalogEntryId", "catalog_entry_resolution_web");
      assignForm.set("intent", "assign");
      assignForm.set("assigneeId", "ops_backup");
      assignForm.set(
        "handoffNote",
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      assignForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_resolution_web",
      );

      const assignResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: assignForm,
          method: "POST",
        }),
      );

      expect(assignResponse.status).toBe(303);

      const checklistForm = new FormData();
      checklistForm.set("catalogEntryId", "catalog_entry_resolution_web");
      checklistForm.set("intent", "checklist");
      checklistForm.set("checklistState", "pending");
      checklistForm.set(
        "checklistItems",
        "Validate queued follow-up\nClose backup handoff",
      );
      checklistForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_resolution_web",
      );

      const checklistResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: checklistForm,
          method: "POST",
        }),
      );

      expect(checklistResponse.status).toBe(303);

      const progressForm = new FormData();
      progressForm.set("catalogEntryId", "catalog_entry_resolution_web");
      progressForm.set("intent", "progress");
      progressForm.set(
        "progressItems",
        "completed: Validate queued follow-up\npending: Close backup handoff",
      );
      progressForm.set("completionNote", "Queued follow-up is almost complete");
      progressForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_resolution_web",
      );

      const progressResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: progressForm,
          method: "POST",
        }),
      );

      expect(progressResponse.status).toBe(303);

      const blockerForm = new FormData();
      blockerForm.set("catalogEntryId", "catalog_entry_resolution_web");
      blockerForm.set("intent", "block");
      blockerForm.set(
        "blockerItems",
        "cleared: Validate queued follow-up\nblocked: Close backup handoff",
      );
      blockerForm.set("blockerNote", "Waiting for the overnight handoff");
      blockerForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_resolution_web",
      );

      const blockerResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: blockerForm,
          method: "POST",
        }),
      );

      expect(blockerResponse.status).toBe(303);

      const resolutionForm = new FormData();
      resolutionForm.set("catalogEntryId", "catalog_entry_resolution_web");
      resolutionForm.set("intent", "resolve");
      resolutionForm.set(
        "resolutionItems",
        "resolved: Validate queued follow-up\nunresolved: Close backup handoff",
      );
      resolutionForm.set(
        "resolutionNote",
        "Backup confirmed the follow-up closure",
      );
      resolutionForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_resolution_web",
      );

      const resolutionResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: resolutionForm,
          method: "POST",
        }),
      );

      expect(resolutionResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const resolvedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_resolution_web",
          }),
        }),
      );

      expect(resolvedMarkup).toContain("Checklist item resolutions");
      expect(resolvedMarkup).toContain("Queued resolution preset");
      expect(resolvedMarkup).toContain("1/2 resolved");
      expect(resolvedMarkup).toContain("Validate queued follow-up");
      expect(resolvedMarkup).toContain("Close backup handoff");
      expect(resolvedMarkup).toContain(
        "Backup confirmed the follow-up closure",
      );
      expect(resolvedMarkup).toContain("Apply resolved preset");
      expect(resolvedMarkup).toContain(
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      expect(resolvedMarkup).toContain("Currently applied");

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearForm = new FormData();
      clearForm.set("catalogEntryId", "catalog_entry_resolution_web");
      clearForm.set("intent", "clear-resolution");
      clearForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_resolution_web",
      );

      const clearResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearForm,
          method: "POST",
        }),
      );

      expect(clearResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_resolution_web",
          }),
        }),
      );

      expect(clearedMarkup).toContain("Checklist item resolutions");
      expect(clearedMarkup).toContain("No checklist item resolutions yet");
      expect(clearedMarkup).not.toContain(
        "Backup confirmed the follow-up closure",
      );
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("renders, verifies, clears, and reapplies checklist item verifications through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-checklist-verifications-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
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
      workerId: "worker_web_verification",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_verification_web",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_verification_web",
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

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const saveForm = new FormData();
      saveForm.set("name", "Queued verification preset");
      saveForm.set("description", "Saved queued worker verification preset");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_verification");
      saveForm.set("auditViewRunId", queuedRun.id);
      saveForm.set("drilldownRunId", queuedRun.id);
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );

      expect(saveResponse.status).toBe(303);

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_verification_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );

      expect(publishResponse.status).toBe(303);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_verification_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const reviewForm = new FormData();
      reviewForm.set("catalogEntryId", "catalog_entry_verification_web");
      reviewForm.set("intent", "review");
      reviewForm.set("note", `Verification ready after inline ${inlineRun.id}`);
      reviewForm.set("reviewState", "recommended");
      reviewForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_verification_web",
      );

      const reviewResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: reviewForm,
          method: "POST",
        }),
      );

      expect(reviewResponse.status).toBe(303);

      const assignForm = new FormData();
      assignForm.set("catalogEntryId", "catalog_entry_verification_web");
      assignForm.set("intent", "assign");
      assignForm.set("assigneeId", "ops_backup");
      assignForm.set(
        "handoffNote",
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      assignForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_verification_web",
      );

      const assignResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: assignForm,
          method: "POST",
        }),
      );

      expect(assignResponse.status).toBe(303);

      const checklistForm = new FormData();
      checklistForm.set("catalogEntryId", "catalog_entry_verification_web");
      checklistForm.set("intent", "checklist");
      checklistForm.set("checklistState", "pending");
      checklistForm.set(
        "checklistItems",
        "Validate queued follow-up\nClose backup handoff",
      );
      checklistForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_verification_web",
      );

      const checklistResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: checklistForm,
          method: "POST",
        }),
      );

      expect(checklistResponse.status).toBe(303);

      const progressForm = new FormData();
      progressForm.set("catalogEntryId", "catalog_entry_verification_web");
      progressForm.set("intent", "progress");
      progressForm.set(
        "progressItems",
        "completed: Validate queued follow-up\npending: Close backup handoff",
      );
      progressForm.set("completionNote", "Queued follow-up is almost complete");
      progressForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_verification_web",
      );

      const progressResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: progressForm,
          method: "POST",
        }),
      );

      expect(progressResponse.status).toBe(303);

      const blockerForm = new FormData();
      blockerForm.set("catalogEntryId", "catalog_entry_verification_web");
      blockerForm.set("intent", "block");
      blockerForm.set(
        "blockerItems",
        "cleared: Validate queued follow-up\nblocked: Close backup handoff",
      );
      blockerForm.set("blockerNote", "Waiting for the overnight handoff");
      blockerForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_verification_web",
      );

      const blockerResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: blockerForm,
          method: "POST",
        }),
      );

      expect(blockerResponse.status).toBe(303);

      const resolutionForm = new FormData();
      resolutionForm.set("catalogEntryId", "catalog_entry_verification_web");
      resolutionForm.set("intent", "resolve");
      resolutionForm.set(
        "resolutionItems",
        "resolved: Validate queued follow-up\nunresolved: Close backup handoff",
      );
      resolutionForm.set(
        "resolutionNote",
        "Backup confirmed the follow-up closure",
      );
      resolutionForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_verification_web",
      );

      const resolutionResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: resolutionForm,
          method: "POST",
        }),
      );

      expect(resolutionResponse.status).toBe(303);

      const verificationForm = new FormData();
      verificationForm.set("catalogEntryId", "catalog_entry_verification_web");
      verificationForm.set("intent", "verify");
      verificationForm.set(
        "verificationItems",
        "verified: Validate queued follow-up\nunverified: Close backup handoff",
      );
      verificationForm.set(
        "verificationNote",
        "Backup verified the follow-up closure",
      );
      verificationForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_verification_web",
      );

      const verificationResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: verificationForm,
          method: "POST",
        }),
      );

      expect(verificationResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const verifiedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_verification_web",
          }),
        }),
      );

      expect(verifiedMarkup).toContain("Checklist item verifications");
      expect(verifiedMarkup).toContain("Queued verification preset");
      expect(verifiedMarkup).toContain("1/2 verified");
      expect(verifiedMarkup).toContain("Validate queued follow-up");
      expect(verifiedMarkup).toContain("Close backup handoff");
      expect(verifiedMarkup).toContain("Backup verified the follow-up closure");
      expect(verifiedMarkup).toContain("Apply verified preset");
      expect(verifiedMarkup).toContain(
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      expect(verifiedMarkup).toContain("Currently applied");

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearForm = new FormData();
      clearForm.set("catalogEntryId", "catalog_entry_verification_web");
      clearForm.set("intent", "clear-verification");
      clearForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_verification_web",
      );

      const clearResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearForm,
          method: "POST",
        }),
      );

      expect(clearResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_verification_web",
          }),
        }),
      );

      expect(clearedMarkup).toContain("Checklist item verifications");
      expect(clearedMarkup).toContain("No checklist item verifications yet");
      expect(clearedMarkup).not.toContain(
        "Backup verified the follow-up closure",
      );
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("renders, records, clears, and reapplies checklist item attestations through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-checklist-evidence-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
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
      workerId: "worker_web_evidence",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_evidence_web",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_evidence_web",
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

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const saveForm = new FormData();
      saveForm.set("name", "Queued evidence preset");
      saveForm.set("description", "Saved queued worker evidence preset");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_evidence");
      saveForm.set("auditViewRunId", queuedRun.id);
      saveForm.set("drilldownRunId", queuedRun.id);
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );

      expect(saveResponse.status).toBe(303);

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_evidence_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );

      expect(publishResponse.status).toBe(303);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_evidence_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const reviewForm = new FormData();
      reviewForm.set("catalogEntryId", "catalog_entry_evidence_web");
      reviewForm.set("intent", "review");
      reviewForm.set("note", `Evidence ready after inline ${inlineRun.id}`);
      reviewForm.set("reviewState", "recommended");
      reviewForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const reviewResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: reviewForm,
          method: "POST",
        }),
      );

      expect(reviewResponse.status).toBe(303);

      const assignForm = new FormData();
      assignForm.set("catalogEntryId", "catalog_entry_evidence_web");
      assignForm.set("intent", "assign");
      assignForm.set("assigneeId", "ops_backup");
      assignForm.set(
        "handoffNote",
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      assignForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const assignResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: assignForm,
          method: "POST",
        }),
      );

      expect(assignResponse.status).toBe(303);

      const checklistForm = new FormData();
      checklistForm.set("catalogEntryId", "catalog_entry_evidence_web");
      checklistForm.set("intent", "checklist");
      checklistForm.set("checklistState", "pending");
      checklistForm.set(
        "checklistItems",
        "Validate queued follow-up\nClose backup handoff",
      );
      checklistForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const checklistResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: checklistForm,
          method: "POST",
        }),
      );

      expect(checklistResponse.status).toBe(303);

      const progressForm = new FormData();
      progressForm.set("catalogEntryId", "catalog_entry_evidence_web");
      progressForm.set("intent", "progress");
      progressForm.set(
        "progressItems",
        "completed: Validate queued follow-up\npending: Close backup handoff",
      );
      progressForm.set("completionNote", "Queued follow-up is almost complete");
      progressForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const progressResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: progressForm,
          method: "POST",
        }),
      );

      expect(progressResponse.status).toBe(303);

      const blockerForm = new FormData();
      blockerForm.set("catalogEntryId", "catalog_entry_evidence_web");
      blockerForm.set("intent", "block");
      blockerForm.set(
        "blockerItems",
        "cleared: Validate queued follow-up\nblocked: Close backup handoff",
      );
      blockerForm.set("blockerNote", "Waiting for the overnight handoff");
      blockerForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const blockerResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: blockerForm,
          method: "POST",
        }),
      );

      expect(blockerResponse.status).toBe(303);

      const resolutionForm = new FormData();
      resolutionForm.set("catalogEntryId", "catalog_entry_evidence_web");
      resolutionForm.set("intent", "resolve");
      resolutionForm.set(
        "resolutionItems",
        "resolved: Validate queued follow-up\nunresolved: Close backup handoff",
      );
      resolutionForm.set(
        "resolutionNote",
        "Backup confirmed the follow-up closure",
      );
      resolutionForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const resolutionResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: resolutionForm,
          method: "POST",
        }),
      );

      expect(resolutionResponse.status).toBe(303);

      const verificationForm = new FormData();
      verificationForm.set("catalogEntryId", "catalog_entry_evidence_web");
      verificationForm.set("intent", "verify");
      verificationForm.set(
        "verificationItems",
        "verified: Validate queued follow-up\nunverified: Close backup handoff",
      );
      verificationForm.set(
        "verificationNote",
        "Backup verified the follow-up closure",
      );
      verificationForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const verificationResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: verificationForm,
          method: "POST",
        }),
      );

      expect(verificationResponse.status).toBe(303);

      const evidenceForm = new FormData();
      evidenceForm.set("catalogEntryId", "catalog_entry_evidence_web");
      evidenceForm.set("intent", "record-evidence");
      evidenceForm.set(
        "evidenceItems",
        "Validate queued follow-up: run://queued-follow-up | note://backup-closeout\nClose backup handoff: doc://backup-handoff",
      );
      evidenceForm.set(
        "evidenceNote",
        "Backup collected stable follow-up references",
      );
      evidenceForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const evidenceResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: evidenceForm,
          method: "POST",
        }),
      );

      expect(evidenceResponse.status).toBe(303);

      const attestationForm = new FormData();
      attestationForm.set("catalogEntryId", "catalog_entry_evidence_web");
      attestationForm.set("intent", "attest");
      attestationForm.set(
        "attestationItems",
        "attested: Validate queued follow-up\nunattested: Close backup handoff",
      );
      attestationForm.set(
        "attestationNote",
        "Backup attested the stable follow-up evidence",
      );
      attestationForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const attestationResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: attestationForm,
          method: "POST",
        }),
      );

      expect(attestationResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const attestedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_evidence_web",
          }),
        }),
      );

      expect(attestedMarkup).toContain("Checklist item attestations");
      expect(attestedMarkup).toContain("Queued evidence preset");
      expect(attestedMarkup).toContain("1/2 attested");
      expect(attestedMarkup).toContain("Validate queued follow-up");
      expect(attestedMarkup).toContain("Close backup handoff");
      expect(attestedMarkup).toContain(
        "Backup attested the stable follow-up evidence",
      );
      expect(attestedMarkup).toContain("Apply attested preset");
      expect(attestedMarkup).toContain(
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      expect(attestedMarkup).toContain("Active attestations selected");

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearForm = new FormData();
      clearForm.set("catalogEntryId", "catalog_entry_evidence_web");
      clearForm.set("intent", "clear-attestation");
      clearForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_evidence_web",
      );

      const clearResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearForm,
          method: "POST",
        }),
      );

      expect(clearResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_evidence_web",
          }),
        }),
      );

      expect(clearedMarkup).toContain("Checklist item attestations");
      expect(clearedMarkup).toContain("No checklist item attestations yet");
      expect(clearedMarkup).not.toContain(
        "Backup attested the stable follow-up evidence",
      );
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });

  it("renders, records, clears, and reapplies checklist item acknowledgments, sign-offs, and exceptions through the existing API surface", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-web-checklist-acknowledgment-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inlineOperator = createRunrootOperatorService({
      executionMode: "inline",
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
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
      workerId: "worker_web_acknowledgment",
    });
    const ownerApp = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_acknowledgment_web",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        persistenceDriver: "sqlite",
        savedViewIdGenerator: () => "saved_view_acknowledgment_web",
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

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const saveForm = new FormData();
      saveForm.set("name", "Queued acknowledgment preset");
      saveForm.set("description", "Saved queued worker acknowledgment preset");
      saveForm.set("summaryExecutionMode", "queued");
      saveForm.set("drilldownWorkerId", "worker_web_acknowledgment");
      saveForm.set("auditViewRunId", queuedRun.id);
      saveForm.set("drilldownRunId", queuedRun.id);
      saveForm.set("returnTo", "/runs");

      const saveResponse = await saveSavedView(
        new Request("http://localhost/runs/saved-views", {
          body: saveForm,
          method: "POST",
        }),
      );

      expect(saveResponse.status).toBe(303);

      const publishForm = new FormData();
      publishForm.set("intent", "publish");
      publishForm.set("savedViewId", "saved_view_acknowledgment_web");

      const publishResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: publishForm,
          method: "POST",
        }),
      );

      expect(publishResponse.status).toBe(303);

      const shareForm = new FormData();
      shareForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      shareForm.set("intent", "share");

      const shareResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: shareForm,
          method: "POST",
        }),
      );

      expect(shareResponse.status).toBe(303);

      const reviewForm = new FormData();
      reviewForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      reviewForm.set("intent", "review");
      reviewForm.set(
        "note",
        `Acknowledgment ready after inline ${inlineRun.id}`,
      );
      reviewForm.set("reviewState", "recommended");
      reviewForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const reviewResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: reviewForm,
          method: "POST",
        }),
      );

      expect(reviewResponse.status).toBe(303);

      const assignForm = new FormData();
      assignForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      assignForm.set("intent", "assign");
      assignForm.set("assigneeId", "ops_backup");
      assignForm.set(
        "handoffNote",
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      assignForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const assignResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: assignForm,
          method: "POST",
        }),
      );

      expect(assignResponse.status).toBe(303);

      const checklistForm = new FormData();
      checklistForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      checklistForm.set("intent", "checklist");
      checklistForm.set("checklistState", "pending");
      checklistForm.set(
        "checklistItems",
        "Validate queued follow-up\nClose backup handoff",
      );
      checklistForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const checklistResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: checklistForm,
          method: "POST",
        }),
      );

      expect(checklistResponse.status).toBe(303);

      const progressForm = new FormData();
      progressForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      progressForm.set("intent", "progress");
      progressForm.set(
        "progressItems",
        "completed: Validate queued follow-up\npending: Close backup handoff",
      );
      progressForm.set("completionNote", "Queued follow-up is almost complete");
      progressForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const progressResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: progressForm,
          method: "POST",
        }),
      );

      expect(progressResponse.status).toBe(303);

      const blockerForm = new FormData();
      blockerForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      blockerForm.set("intent", "block");
      blockerForm.set(
        "blockerItems",
        "cleared: Validate queued follow-up\nblocked: Close backup handoff",
      );
      blockerForm.set("blockerNote", "Waiting for the overnight handoff");
      blockerForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const blockerResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: blockerForm,
          method: "POST",
        }),
      );

      expect(blockerResponse.status).toBe(303);

      const resolutionForm = new FormData();
      resolutionForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      resolutionForm.set("intent", "resolve");
      resolutionForm.set(
        "resolutionItems",
        "resolved: Validate queued follow-up\nunresolved: Close backup handoff",
      );
      resolutionForm.set(
        "resolutionNote",
        "Backup confirmed the follow-up closure",
      );
      resolutionForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const resolutionResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: resolutionForm,
          method: "POST",
        }),
      );

      expect(resolutionResponse.status).toBe(303);

      const verificationForm = new FormData();
      verificationForm.set(
        "catalogEntryId",
        "catalog_entry_acknowledgment_web",
      );
      verificationForm.set("intent", "verify");
      verificationForm.set(
        "verificationItems",
        "verified: Validate queued follow-up\nunverified: Close backup handoff",
      );
      verificationForm.set(
        "verificationNote",
        "Backup verified the follow-up closure",
      );
      verificationForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const verificationResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: verificationForm,
          method: "POST",
        }),
      );

      expect(verificationResponse.status).toBe(303);

      const evidenceForm = new FormData();
      evidenceForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      evidenceForm.set("intent", "record-evidence");
      evidenceForm.set(
        "evidenceItems",
        "Validate queued follow-up: run://queued-follow-up | note://backup-closeout\nClose backup handoff: doc://backup-handoff",
      );
      evidenceForm.set(
        "evidenceNote",
        "Backup collected stable follow-up references",
      );
      evidenceForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const evidenceResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: evidenceForm,
          method: "POST",
        }),
      );

      expect(evidenceResponse.status).toBe(303);

      const attestationForm = new FormData();
      attestationForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      attestationForm.set("intent", "attest");
      attestationForm.set(
        "attestationItems",
        "attested: Validate queued follow-up\nunattested: Close backup handoff",
      );
      attestationForm.set(
        "attestationNote",
        "Backup attested the stable follow-up evidence",
      );
      attestationForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const attestationResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: attestationForm,
          method: "POST",
        }),
      );

      expect(attestationResponse.status).toBe(303);

      const acknowledgmentForm = new FormData();
      acknowledgmentForm.set(
        "catalogEntryId",
        "catalog_entry_acknowledgment_web",
      );
      acknowledgmentForm.set("intent", "acknowledge");
      acknowledgmentForm.set(
        "acknowledgmentItems",
        "acknowledged: Validate queued follow-up\nunacknowledged: Close backup handoff",
      );
      acknowledgmentForm.set(
        "acknowledgmentNote",
        "Backup acknowledged the attested follow-up",
      );
      acknowledgmentForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const acknowledgmentResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: acknowledgmentForm,
          method: "POST",
        }),
      );

      expect(acknowledgmentResponse.status).toBe(303);

      const signoffForm = new FormData();
      signoffForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      signoffForm.set("intent", "sign-off");
      signoffForm.set(
        "signoffItems",
        "signed-off: Validate queued follow-up\nunsigned: Close backup handoff",
      );
      signoffForm.set(
        "signoffNote",
        "Backup signed off the acknowledged follow-up",
      );
      signoffForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const signoffResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: signoffForm,
          method: "POST",
        }),
      );

      expect(signoffResponse.status).toBe(303);

      const exceptionForm = new FormData();
      exceptionForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      exceptionForm.set("intent", "record-exception");
      exceptionForm.set(
        "exceptionItems",
        "excepted: Validate queued follow-up\nnot-excepted: Close backup handoff",
      );
      exceptionForm.set(
        "exceptionNote",
        "Backup marked the signed-off follow-up for manual review",
      );
      exceptionForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const exceptionResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: exceptionForm,
          method: "POST",
        }),
      );

      expect(exceptionResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const signedOffMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_acknowledgment_web",
          }),
        }),
      );

      expect(signedOffMarkup).toContain("Checklist item acknowledgments");
      expect(signedOffMarkup).toContain("Queued acknowledgment preset");
      expect(signedOffMarkup).toContain("1/2 acknowledged");
      expect(signedOffMarkup).toContain("Validate queued follow-up");
      expect(signedOffMarkup).toContain("Close backup handoff");
      expect(signedOffMarkup).toContain(
        "Backup acknowledged the attested follow-up",
      );
      expect(signedOffMarkup).toContain("Apply acknowledged preset");
      expect(signedOffMarkup).toContain(
        `Queued worker ${queuedRun.id} handed to backup`,
      );
      expect(signedOffMarkup).toContain("Active acknowledgments selected");
      expect(signedOffMarkup).toContain("Checklist item sign-offs");
      expect(signedOffMarkup).toContain("1/2 signed off");
      expect(signedOffMarkup).toContain(
        "Backup signed off the acknowledged follow-up",
      );
      expect(signedOffMarkup).toContain("Apply signed-off preset");
      expect(signedOffMarkup).toContain("Active sign-offs selected");
      expect(signedOffMarkup).toContain("Checklist item exceptions");
      expect(signedOffMarkup).toContain("1/2 excepted");
      expect(signedOffMarkup).toContain(
        "Backup marked the signed-off follow-up for manual review",
      );
      expect(signedOffMarkup).toContain("Apply excepted preset");
      expect(signedOffMarkup).toContain("Active exceptions selected");

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearExceptionForm = new FormData();
      clearExceptionForm.set(
        "catalogEntryId",
        "catalog_entry_acknowledgment_web",
      );
      clearExceptionForm.set("intent", "clear-exception");
      clearExceptionForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const clearExceptionResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearExceptionForm,
          method: "POST",
        }),
      );

      expect(clearExceptionResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedExceptionMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_acknowledgment_web",
          }),
        }),
      );

      expect(clearedExceptionMarkup).toContain("Checklist item exceptions");
      expect(clearedExceptionMarkup).toContain(
        "No checklist item exceptions yet",
      );
      expect(clearedExceptionMarkup).not.toContain(
        "Backup marked the signed-off follow-up for manual review",
      );

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearSignoffForm = new FormData();
      clearSignoffForm.set(
        "catalogEntryId",
        "catalog_entry_acknowledgment_web",
      );
      clearSignoffForm.set("intent", "clear-sign-off");
      clearSignoffForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const clearSignoffResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearSignoffForm,
          method: "POST",
        }),
      );

      expect(clearSignoffResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedSignoffMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_acknowledgment_web",
          }),
        }),
      );

      expect(clearedSignoffMarkup).toContain("Checklist item sign-offs");
      expect(clearedSignoffMarkup).toContain("No checklist item sign-offs yet");
      expect(clearedSignoffMarkup).not.toContain(
        "Backup signed off the acknowledged follow-up",
      );

      process.env.RUNROOT_API_BASE_URL = ownerAddress;

      const clearForm = new FormData();
      clearForm.set("catalogEntryId", "catalog_entry_acknowledgment_web");
      clearForm.set("intent", "clear-acknowledgment");
      clearForm.set(
        "returnTo",
        "/runs?catalogEntryId=catalog_entry_acknowledgment_web",
      );

      const clearResponse = await mutateCatalog(
        new Request("http://localhost/runs/catalog", {
          body: clearForm,
          method: "POST",
        }),
      );

      expect(clearResponse.status).toBe(303);

      process.env.RUNROOT_API_BASE_URL = peerAddress;

      const clearedMarkup = renderToStaticMarkup(
        await RunsPage({
          searchParams: Promise.resolve({
            catalogEntryId: "catalog_entry_acknowledgment_web",
          }),
        }),
      );

      expect(clearedMarkup).toContain("Checklist item acknowledgments");
      expect(clearedMarkup).toContain("No checklist item acknowledgments yet");
      expect(clearedMarkup).not.toContain(
        "Backup acknowledged the attested follow-up",
      );
    } finally {
      await ownerApp.close();
      await peerApp.close();
    }
  });
});
