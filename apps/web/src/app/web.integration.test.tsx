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
});
