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

  it("links summaries, drilldowns, and run audit views for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-navigation-"),
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
      workerId: "worker_navigation",
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

    const summaries = await queryService.getAuditNavigation();
    const queuedNavigation = await queryService.getAuditNavigation({
      drilldown: {
        workerId: "worker_navigation",
      },
      summary: {
        executionMode: "queued",
      },
    });

    expect(summaries.isConstrained).toBe(false);
    expect(summaries.totalSummaryCount).toBe(2);
    expect(summaries.summaries.map((summary) => summary.result.runId)).toEqual([
      queuedRun.id,
      inlineRun.id,
    ]);
    expect(
      summaries.summaries.find(
        (summary) => summary.result.runId === inlineRun.id,
      )?.links.auditView,
    ).toMatchObject({
      kind: "run-audit-view",
      runId: inlineRun.id,
    });
    expect(queuedNavigation.isConstrained).toBe(true);
    expect(queuedNavigation.totalSummaryCount).toBe(1);
    expect(queuedNavigation.summaries[0]?.result.runId).toBe(queuedRun.id);
    expect(queuedNavigation.drilldowns[0]).toMatchObject({
      result: {
        runId: queuedRun.id,
      },
    });
    expect(queuedNavigation.drilldowns[0]?.links.auditView).toMatchObject({
      kind: "run-audit-view",
      runId: queuedRun.id,
    });
    expect(
      queuedNavigation.summaries[0]?.links.drilldowns.some(
        (link) =>
          link.kind === "audit-drilldown" &&
          link.filters.workerId === "worker_navigation",
      ),
    ).toBe(true);
  });

  it("saves, lists, loads, and applies constrained audit views for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-saved-views-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    const inlineService = createRunrootOperatorService({
      executionMode: "inline",
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => "saved_view_1",
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
      workerId: "worker_saved_view",
    });
    const queryService = createRunrootOperatorService({
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      sqlitePath,
    });

    await inlineService.startRun({
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

    const savedView = await inlineService.saveSavedView({
      description: "Queued worker investigation",
      name: "Queued worker follow-up",
      navigation: {
        drilldown: {
          workerId: "worker_saved_view",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const savedViews = await queryService.listSavedViews();
    const loadedSavedView = await queryService.getSavedView(savedView.id);
    const application = await queryService.applySavedView(savedView.id);

    expect(savedView).toMatchObject({
      id: "saved_view_1",
      kind: "saved-view",
      name: "Queued worker follow-up",
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    expect(savedViews.totalCount).toBe(1);
    expect(savedViews.items[0]?.id).toBe(savedView.id);
    expect(loadedSavedView).toMatchObject({
      id: savedView.id,
      navigation: {
        drilldown: {
          workerId: "worker_saved_view",
        },
        summary: {
          executionMode: "queued",
        },
      },
    });
    expect(application?.savedView.id).toBe(savedView.id);
    expect(application?.navigation.totalSummaryCount).toBe(1);
    expect(application?.navigation.drilldowns[0]).toMatchObject({
      result: {
        runId: queuedRun.id,
      },
    });
  });

  it("publishes, shares, lists, inspects, unshares, archives, and applies audit view catalog entries for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-sdk-catalog-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    const inlineService = createRunrootOperatorService({
      executionMode: "inline",
      idGenerator,
      now,
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => "saved_view_catalog_1",
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
      workerId: "worker_catalog",
    });
    const queryService = createRunrootOperatorService({
      catalogEntryIdGenerator: () => "catalog_entry_1",
      idGenerator,
      now,
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      sqlitePath,
    });
    const peerService = createRunrootOperatorService({
      idGenerator,
      now,
      operatorId: "ops_backup",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      sqlitePath,
    });

    await inlineService.startRun({
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

    const savedView = await inlineService.saveSavedView({
      description: "Queued worker catalog entry",
      name: "Queued worker preset",
      navigation: {
        drilldown: {
          workerId: "worker_catalog",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const publishedEntry = await queryService.publishCatalogEntry({
      savedViewId: savedView.id,
    });
    const listedEntries = await queryService.listCatalogEntries();
    const visibleEntries = await queryService.listVisibleCatalogEntries();
    const peerVisibleBeforeShare =
      await peerService.listVisibleCatalogEntries();
    const ownerVisibility = await queryService.getCatalogVisibility(
      publishedEntry.entry.id,
    );
    const sharedVisibility = await queryService.shareCatalogEntry(
      publishedEntry.entry.id,
    );
    const peerVisibleAfterShare = await peerService.listVisibleCatalogEntries();
    const peerInspection = await peerService.getCatalogVisibility(
      publishedEntry.entry.id,
    );
    const inspectedEntry = await queryService.getCatalogEntry(
      publishedEntry.entry.id,
    );
    const appliedEntry = await peerService.applyCatalogEntry(
      publishedEntry.entry.id,
    );
    const unsharedVisibility = await queryService.unshareCatalogEntry(
      publishedEntry.entry.id,
    );
    const peerVisibleAfterUnshare =
      await peerService.listVisibleCatalogEntries();
    const archivedEntry = await queryService.archiveCatalogEntry(
      publishedEntry.entry.id,
    );
    const listedAfterArchive = await queryService.listCatalogEntries();

    expect(publishedEntry).toMatchObject({
      entry: {
        id: "catalog_entry_1",
        kind: "catalog-entry",
        name: "Queued worker preset",
        savedViewId: savedView.id,
      },
      savedView: {
        id: savedView.id,
      },
    });
    expect(listedEntries.totalCount).toBe(1);
    expect(listedEntries.items[0]?.entry.id).toBe("catalog_entry_1");
    expect(visibleEntries.totalCount).toBe(1);
    expect(visibleEntries.items[0]?.visibility.state).toBe("personal");
    expect(peerVisibleBeforeShare.totalCount).toBe(0);
    expect(ownerVisibility.visibility).toMatchObject({
      ownerId: "ops_oncall",
      scopeId: "ops",
      state: "personal",
    });
    expect(sharedVisibility.visibility.state).toBe("shared");
    expect(peerVisibleAfterShare.totalCount).toBe(1);
    expect(peerInspection.visibility.state).toBe("shared");
    expect(inspectedEntry).toMatchObject({
      entry: {
        id: "catalog_entry_1",
      },
      savedView: {
        refs: {
          auditViewRunId: queuedRun.id,
        },
      },
    });
    expect(appliedEntry.application.savedView.id).toBe(savedView.id);
    expect(appliedEntry.application.navigation.totalSummaryCount).toBe(1);
    expect(appliedEntry.application.navigation.drilldowns[0]).toMatchObject({
      result: {
        runId: queuedRun.id,
      },
    });
    expect(unsharedVisibility.visibility.state).toBe("personal");
    expect(peerVisibleAfterUnshare.totalCount).toBe(0);
    expect(archivedEntry.entry.archivedAt).toBeTruthy();
    expect(listedAfterArchive.totalCount).toBe(0);
  });

  it("reviews, lists-reviewed, inspects, clears, and reapplies reviewed presets for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-review-signals-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    let savedViewCount = 0;
    let catalogEntryCount = 0;
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
      workerId: "worker_review_signals",
    });
    const ownerService = createRunrootOperatorService({
      catalogEntryIdGenerator: () =>
        `catalog_entry_review_${++catalogEntryCount}`,
      idGenerator,
      now,
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => `saved_view_review_${++savedViewCount}`,
      sqlitePath,
    });
    const peerService = createRunrootOperatorService({
      idGenerator,
      now,
      operatorId: "ops_backup",
      operatorScopeId: "ops",
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

    const inlineSavedView = await ownerService.saveSavedView({
      description: "Inline preset for owner follow-up",
      name: "Inline review preset",
      navigation: {
        drilldown: {
          runId: inlineRun.id,
        },
        summary: {
          executionMode: "inline",
        },
      },
      refs: {
        auditViewRunId: inlineRun.id,
        drilldownRunId: inlineRun.id,
      },
    });
    const queuedSavedView = await ownerService.saveSavedView({
      description: "Queued preset for shared review",
      name: "Queued review preset",
      navigation: {
        drilldown: {
          workerId: "worker_review_signals",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const inlineCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: inlineSavedView.id,
    });
    const queuedCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: queuedSavedView.id,
    });

    await ownerService.shareCatalogEntry(queuedCatalogEntry.entry.id);
    await ownerService.reviewCatalogEntry(inlineCatalogEntry.entry.id, {
      note: "Inline preset verified by the owner",
      state: "reviewed",
    });
    await peerService.reviewCatalogEntry(queuedCatalogEntry.entry.id, {
      note: "Queued preset recommended for shared follow-up",
      state: "recommended",
    });

    const ownerReviewed = await ownerService.listReviewedCatalogEntries();
    const peerReviewed = await peerService.listReviewedCatalogEntries();
    const inspectedReview = await ownerService.getCatalogReviewSignal(
      queuedCatalogEntry.entry.id,
    );
    const appliedReview = await peerService.applyCatalogEntry(
      queuedCatalogEntry.entry.id,
    );
    const clearedReview = await ownerService.clearCatalogReviewSignal(
      queuedCatalogEntry.entry.id,
    );
    const peerReviewedAfterClear =
      await peerService.listReviewedCatalogEntries();

    expect(
      ownerReviewed.items.map((item) => item.visibility.catalogEntry.entry.id),
    ).toEqual([queuedCatalogEntry.entry.id, inlineCatalogEntry.entry.id]);
    expect(
      peerReviewed.items.map((item) => item.visibility.catalogEntry.entry.id),
    ).toEqual([queuedCatalogEntry.entry.id]);
    expect(inspectedReview.review).toMatchObject({
      note: "Queued preset recommended for shared follow-up",
      operatorId: "ops_backup",
      scopeId: "ops",
      state: "recommended",
    });
    expect(appliedReview.catalogEntry.entry.id).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(appliedReview.application.savedView.id).toBe(queuedSavedView.id);
    expect(appliedReview.application.navigation.totalSummaryCount).toBe(1);
    expect(
      appliedReview.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.id);
    expect(clearedReview.review.state).toBe("recommended");
    expect(peerReviewedAfterClear.totalCount).toBe(0);
  });

  it("assigns, lists-assigned, inspects, clears, and reapplies reviewed presets for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-review-assignments-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    let savedViewCount = 0;
    let catalogEntryCount = 0;
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
      workerId: "worker_review_assignments",
    });
    const ownerService = createRunrootOperatorService({
      catalogEntryIdGenerator: () =>
        `catalog_entry_assignment_${++catalogEntryCount}`,
      idGenerator,
      now,
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => `saved_view_assignment_${++savedViewCount}`,
      sqlitePath,
    });
    const peerService = createRunrootOperatorService({
      idGenerator,
      now,
      operatorId: "ops_backup",
      operatorScopeId: "ops",
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

    const inlineSavedView = await ownerService.saveSavedView({
      description: "Inline preset for owner assignment follow-up",
      name: "Inline assignment preset",
      navigation: {
        drilldown: {
          runId: inlineRun.id,
        },
        summary: {
          executionMode: "inline",
        },
      },
      refs: {
        auditViewRunId: inlineRun.id,
        drilldownRunId: inlineRun.id,
      },
    });
    const queuedSavedView = await ownerService.saveSavedView({
      description: "Queued preset for shared assignment follow-up",
      name: "Queued assignment preset",
      navigation: {
        drilldown: {
          workerId: "worker_review_assignments",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const inlineCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: inlineSavedView.id,
    });
    const queuedCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: queuedSavedView.id,
    });

    await ownerService.shareCatalogEntry(queuedCatalogEntry.entry.id);
    await ownerService.reviewCatalogEntry(inlineCatalogEntry.entry.id, {
      note: "Inline preset stays with the owner",
      state: "reviewed",
    });
    await peerService.reviewCatalogEntry(queuedCatalogEntry.entry.id, {
      note: "Queued preset handed off to the backup operator",
      state: "recommended",
    });

    await ownerService.assignCatalogEntry(inlineCatalogEntry.entry.id, {
      assigneeId: "ops_oncall",
      handoffNote: "Inline preset remains with the owner",
    });
    await ownerService.assignCatalogEntry(queuedCatalogEntry.entry.id, {
      assigneeId: "ops_backup",
      handoffNote: "Queued handoff for overnight follow-up",
    });

    const ownerAssignments = await ownerService.listAssignedCatalogEntries();
    const peerAssignments = await peerService.listAssignedCatalogEntries();
    const inspectedAssignment = await ownerService.getCatalogReviewAssignment(
      queuedCatalogEntry.entry.id,
    );
    const appliedAssignment = await peerService.applyCatalogEntry(
      queuedCatalogEntry.entry.id,
    );
    const clearedAssignment = await ownerService.clearCatalogReviewAssignment(
      queuedCatalogEntry.entry.id,
    );
    const peerAssignmentsAfterClear =
      await peerService.listAssignedCatalogEntries();

    expect(
      ownerAssignments.items.map(
        (item) => item.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id, inlineCatalogEntry.entry.id]);
    expect(
      peerAssignments.items.map(
        (item) => item.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id]);
    expect(inspectedAssignment.assignment).toMatchObject({
      assigneeId: "ops_backup",
      assignerId: "ops_oncall",
      catalogEntryId: queuedCatalogEntry.entry.id,
      handoffNote: "Queued handoff for overnight follow-up",
      scopeId: "ops",
      state: "assigned",
    });
    expect(appliedAssignment.catalogEntry.entry.id).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(appliedAssignment.application.savedView.id).toBe(queuedSavedView.id);
    expect(appliedAssignment.application.navigation.totalSummaryCount).toBe(1);
    expect(
      appliedAssignment.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.id);
    expect(clearedAssignment.assignment.assigneeId).toBe("ops_backup");
    expect(peerAssignmentsAfterClear.totalCount).toBe(0);
  });

  it("checklists, lists-checklisted, inspects, clears, and reapplies assigned reviewed presets for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-assignment-checklists-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    let savedViewCount = 0;
    let catalogEntryCount = 0;
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
      workerId: "worker_assignment_checklists",
    });
    const ownerService = createRunrootOperatorService({
      catalogEntryIdGenerator: () =>
        `catalog_entry_checklist_${++catalogEntryCount}`,
      idGenerator,
      now,
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => `saved_view_checklist_${++savedViewCount}`,
      sqlitePath,
    });
    const peerService = createRunrootOperatorService({
      idGenerator,
      now,
      operatorId: "ops_backup",
      operatorScopeId: "ops",
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

    const inlineSavedView = await ownerService.saveSavedView({
      description: "Inline checklist preset for owner follow-up",
      name: "Inline checklist preset",
      navigation: {
        drilldown: {
          runId: inlineRun.id,
        },
        summary: {
          executionMode: "inline",
        },
      },
      refs: {
        auditViewRunId: inlineRun.id,
        drilldownRunId: inlineRun.id,
      },
    });
    const queuedSavedView = await ownerService.saveSavedView({
      description: "Queued checklist preset for shared follow-up",
      name: "Queued checklist preset",
      navigation: {
        drilldown: {
          workerId: "worker_assignment_checklists",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const inlineCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: inlineSavedView.id,
    });
    const queuedCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: queuedSavedView.id,
    });

    await ownerService.shareCatalogEntry(queuedCatalogEntry.entry.id);
    await ownerService.reviewCatalogEntry(inlineCatalogEntry.entry.id, {
      note: "Inline checklist stays with the owner",
      state: "reviewed",
    });
    await peerService.reviewCatalogEntry(queuedCatalogEntry.entry.id, {
      note: "Queued checklist preset is ready for backup follow-up",
      state: "recommended",
    });
    await ownerService.assignCatalogEntry(inlineCatalogEntry.entry.id, {
      assigneeId: "ops_oncall",
      handoffNote: "Inline checklist remains with the owner",
    });
    await ownerService.assignCatalogEntry(queuedCatalogEntry.entry.id, {
      assigneeId: "ops_backup",
      handoffNote: "Queued checklist handed to the backup operator",
    });
    await ownerService.checklistCatalogEntry(inlineCatalogEntry.entry.id, {
      items: ["Confirm inline owner handoff"],
      state: "completed",
    });
    await ownerService.checklistCatalogEntry(queuedCatalogEntry.entry.id, {
      items: ["Validate queued follow-up", "Close backup handoff"],
      state: "pending",
    });

    const ownerChecklists = await ownerService.listChecklistedCatalogEntries();
    const peerChecklists = await peerService.listChecklistedCatalogEntries();
    const inspectedChecklist = await ownerService.getCatalogAssignmentChecklist(
      queuedCatalogEntry.entry.id,
    );
    const appliedChecklist = await peerService.applyCatalogEntry(
      queuedCatalogEntry.entry.id,
    );
    const clearedChecklist = await ownerService.clearCatalogAssignmentChecklist(
      queuedCatalogEntry.entry.id,
    );
    const peerChecklistsAfterClear =
      await peerService.listChecklistedCatalogEntries();

    expect(
      ownerChecklists.items.map(
        (item) => item.assignment.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id, inlineCatalogEntry.entry.id]);
    expect(
      peerChecklists.items.map(
        (item) => item.assignment.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id]);
    expect(inspectedChecklist.checklist).toMatchObject({
      catalogEntryId: queuedCatalogEntry.entry.id,
      items: ["Validate queued follow-up", "Close backup handoff"],
      operatorId: "ops_oncall",
      scopeId: "ops",
      state: "pending",
    });
    expect(appliedChecklist.catalogEntry.entry.id).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(appliedChecklist.application.savedView.id).toBe(queuedSavedView.id);
    expect(appliedChecklist.application.navigation.totalSummaryCount).toBe(1);
    expect(
      appliedChecklist.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.id);
    expect(clearedChecklist.checklist.state).toBe("pending");
    expect(peerChecklistsAfterClear.totalCount).toBe(0);
  });

  it("progresses, lists-progressed, inspects, clears, and reapplies checklisted presets for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-checklist-progress-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    let savedViewCount = 0;
    let catalogEntryCount = 0;
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
      workerId: "worker_checklist_progress",
    });
    const ownerService = createRunrootOperatorService({
      catalogEntryIdGenerator: () =>
        `catalog_entry_progress_${++catalogEntryCount}`,
      idGenerator,
      now,
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => `saved_view_progress_${++savedViewCount}`,
      sqlitePath,
    });
    const peerService = createRunrootOperatorService({
      idGenerator,
      now,
      operatorId: "ops_backup",
      operatorScopeId: "ops",
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

    const inlineSavedView = await ownerService.saveSavedView({
      description: "Inline progress preset for owner follow-up",
      name: "Inline progress preset",
      navigation: {
        drilldown: {
          runId: inlineRun.id,
        },
        summary: {
          executionMode: "inline",
        },
      },
      refs: {
        auditViewRunId: inlineRun.id,
        drilldownRunId: inlineRun.id,
      },
    });
    const queuedSavedView = await ownerService.saveSavedView({
      description: "Queued progress preset for shared follow-up",
      name: "Queued progress preset",
      navigation: {
        drilldown: {
          workerId: "worker_checklist_progress",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const inlineCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: inlineSavedView.id,
    });
    const queuedCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: queuedSavedView.id,
    });

    await ownerService.shareCatalogEntry(queuedCatalogEntry.entry.id);
    await ownerService.reviewCatalogEntry(inlineCatalogEntry.entry.id, {
      note: "Inline preset verified by the owner",
      state: "reviewed",
    });
    await peerService.reviewCatalogEntry(queuedCatalogEntry.entry.id, {
      note: "Queued preset ready for backup follow-up",
      state: "recommended",
    });
    await ownerService.assignCatalogEntry(inlineCatalogEntry.entry.id, {
      assigneeId: "ops_oncall",
      handoffNote: "Inline preset remains with the owner",
    });
    await ownerService.assignCatalogEntry(queuedCatalogEntry.entry.id, {
      assigneeId: "ops_backup",
      handoffNote: "Queued preset handed to the backup operator",
    });
    await ownerService.checklistCatalogEntry(inlineCatalogEntry.entry.id, {
      items: ["Confirm inline owner follow-up"],
      state: "completed",
    });
    await ownerService.checklistCatalogEntry(queuedCatalogEntry.entry.id, {
      items: ["Validate queued follow-up", "Close backup handoff"],
      state: "pending",
    });
    await ownerService.progressCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "completed",
        },
      ],
    });
    await ownerService.progressCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });

    const ownerProgress = await ownerService.listProgressedCatalogEntries();
    const peerProgress = await peerService.listProgressedCatalogEntries();
    const inspectedProgress =
      await ownerService.getCatalogChecklistItemProgress(
        queuedCatalogEntry.entry.id,
      );
    const appliedProgress = await peerService.applyCatalogEntry(
      queuedCatalogEntry.entry.id,
    );
    const clearedProgress =
      await ownerService.clearCatalogChecklistItemProgress(
        queuedCatalogEntry.entry.id,
      );
    const peerProgressAfterClear =
      await peerService.listProgressedCatalogEntries();

    expect(
      ownerProgress.items.map(
        (item) =>
          item.checklist.assignment.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id, inlineCatalogEntry.entry.id]);
    expect(
      peerProgress.items.map(
        (item) =>
          item.checklist.assignment.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id]);
    expect(inspectedProgress.progress).toMatchObject({
      catalogEntryId: queuedCatalogEntry.entry.id,
      completionNote: "Queued follow-up is almost complete",
      operatorId: "ops_oncall",
      scopeId: "ops",
    });
    expect(inspectedProgress.progress.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "completed",
      },
      {
        item: "Close backup handoff",
        state: "pending",
      },
    ]);
    expect(appliedProgress.catalogEntry.entry.id).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(appliedProgress.application.savedView.id).toBe(queuedSavedView.id);
    expect(appliedProgress.application.navigation.totalSummaryCount).toBe(1);
    expect(
      appliedProgress.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.id);
    expect(clearedProgress.progress.catalogEntryId).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(peerProgressAfterClear.totalCount).toBe(0);
  });

  it("blocks, lists-blocked, inspects, clears, and reapplies progressed presets for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-checklist-blockers-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    let savedViewCount = 0;
    let catalogEntryCount = 0;
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
      workerId: "worker_checklist_blockers",
    });
    const ownerService = createRunrootOperatorService({
      catalogEntryIdGenerator: () =>
        `catalog_entry_blocker_${++catalogEntryCount}`,
      idGenerator,
      now,
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => `saved_view_blocker_${++savedViewCount}`,
      sqlitePath,
    });
    const peerService = createRunrootOperatorService({
      idGenerator,
      now,
      operatorId: "ops_backup",
      operatorScopeId: "ops",
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

    const inlineSavedView = await ownerService.saveSavedView({
      description: "Inline blocker preset for owner follow-up",
      name: "Inline blocker preset",
      navigation: {
        drilldown: {
          runId: inlineRun.id,
        },
        summary: {
          executionMode: "inline",
        },
      },
      refs: {
        auditViewRunId: inlineRun.id,
        drilldownRunId: inlineRun.id,
      },
    });
    const queuedSavedView = await ownerService.saveSavedView({
      description: "Queued blocker preset for shared follow-up",
      name: "Queued blocker preset",
      navigation: {
        drilldown: {
          workerId: "worker_checklist_blockers",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const inlineCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: inlineSavedView.id,
    });
    const queuedCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: queuedSavedView.id,
    });

    await ownerService.shareCatalogEntry(queuedCatalogEntry.entry.id);
    await ownerService.reviewCatalogEntry(inlineCatalogEntry.entry.id, {
      note: "Inline blocker preset verified by the owner",
      state: "reviewed",
    });
    await peerService.reviewCatalogEntry(queuedCatalogEntry.entry.id, {
      note: "Queued blocker preset ready for backup follow-up",
      state: "recommended",
    });
    await ownerService.assignCatalogEntry(inlineCatalogEntry.entry.id, {
      assigneeId: "ops_oncall",
      handoffNote: "Inline blocker preset remains with the owner",
    });
    await ownerService.assignCatalogEntry(queuedCatalogEntry.entry.id, {
      assigneeId: "ops_backup",
      handoffNote: "Queued blocker preset handed to the backup operator",
    });
    await ownerService.checklistCatalogEntry(inlineCatalogEntry.entry.id, {
      items: ["Confirm inline owner follow-up"],
      state: "completed",
    });
    await ownerService.checklistCatalogEntry(queuedCatalogEntry.entry.id, {
      items: ["Validate queued follow-up", "Close backup handoff"],
      state: "pending",
    });
    await ownerService.progressCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "completed",
        },
      ],
    });
    await ownerService.progressCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.blockCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "blocked",
        },
      ],
    });
    await ownerService.blockCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });

    const ownerBlockers = await ownerService.listBlockedCatalogEntries();
    const peerBlockers = await peerService.listBlockedCatalogEntries();
    const inspectedBlocker = await ownerService.getCatalogChecklistItemBlocker(
      queuedCatalogEntry.entry.id,
    );
    const appliedBlocker = await peerService.applyCatalogEntry(
      queuedCatalogEntry.entry.id,
    );
    const clearedBlocker = await ownerService.clearCatalogChecklistItemBlocker(
      queuedCatalogEntry.entry.id,
    );
    const peerBlockersAfterClear =
      await peerService.listBlockedCatalogEntries();

    expect(
      ownerBlockers.items.map(
        (item) =>
          item.progress.checklist.assignment.review.visibility.catalogEntry
            .entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id, inlineCatalogEntry.entry.id]);
    expect(
      peerBlockers.items.map(
        (item) =>
          item.progress.checklist.assignment.review.visibility.catalogEntry
            .entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id]);
    expect(inspectedBlocker.blocker).toMatchObject({
      blockerNote: "Waiting for the overnight handoff",
      catalogEntryId: queuedCatalogEntry.entry.id,
      operatorId: "ops_oncall",
      scopeId: "ops",
    });
    expect(inspectedBlocker.blocker.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "cleared",
      },
      {
        item: "Close backup handoff",
        state: "blocked",
      },
    ]);
    expect(appliedBlocker.catalogEntry.entry.id).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(appliedBlocker.application.savedView.id).toBe(queuedSavedView.id);
    expect(appliedBlocker.application.navigation.totalSummaryCount).toBe(1);
    expect(
      appliedBlocker.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.id);
    expect(clearedBlocker.blocker.catalogEntryId).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(peerBlockersAfterClear.totalCount).toBe(0);
  });

  it("resolves, lists-resolved, inspects, clears, and reapplies blocked presets for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-checklist-resolutions-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    let savedViewCount = 0;
    let catalogEntryCount = 0;
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
      workerId: "worker_checklist_resolutions",
    });
    const ownerService = createRunrootOperatorService({
      catalogEntryIdGenerator: () =>
        `catalog_entry_resolution_${++catalogEntryCount}`,
      idGenerator,
      now,
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => `saved_view_resolution_${++savedViewCount}`,
      sqlitePath,
    });
    const peerService = createRunrootOperatorService({
      idGenerator,
      now,
      operatorId: "ops_backup",
      operatorScopeId: "ops",
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

    const inlineSavedView = await ownerService.saveSavedView({
      description: "Inline resolution preset for owner follow-up",
      name: "Inline resolution preset",
      navigation: {
        drilldown: {
          runId: inlineRun.id,
        },
        summary: {
          executionMode: "inline",
        },
      },
      refs: {
        auditViewRunId: inlineRun.id,
        drilldownRunId: inlineRun.id,
      },
    });
    const queuedSavedView = await ownerService.saveSavedView({
      description: "Queued resolution preset for shared follow-up",
      name: "Queued resolution preset",
      navigation: {
        drilldown: {
          workerId: "worker_checklist_resolutions",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const inlineCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: inlineSavedView.id,
    });
    const queuedCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: queuedSavedView.id,
    });

    await ownerService.shareCatalogEntry(queuedCatalogEntry.entry.id);
    await ownerService.reviewCatalogEntry(inlineCatalogEntry.entry.id, {
      note: "Inline resolution preset verified by the owner",
      state: "reviewed",
    });
    await peerService.reviewCatalogEntry(queuedCatalogEntry.entry.id, {
      note: "Queued resolution preset ready for backup follow-up",
      state: "recommended",
    });
    await ownerService.assignCatalogEntry(inlineCatalogEntry.entry.id, {
      assigneeId: "ops_oncall",
      handoffNote: "Inline resolution preset remains with the owner",
    });
    await ownerService.assignCatalogEntry(queuedCatalogEntry.entry.id, {
      assigneeId: "ops_backup",
      handoffNote: "Queued resolution preset handed to the backup operator",
    });
    await ownerService.checklistCatalogEntry(inlineCatalogEntry.entry.id, {
      items: ["Confirm inline owner follow-up"],
      state: "completed",
    });
    await ownerService.checklistCatalogEntry(queuedCatalogEntry.entry.id, {
      items: ["Validate queued follow-up", "Close backup handoff"],
      state: "pending",
    });
    await ownerService.progressCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "completed",
        },
      ],
    });
    await ownerService.progressCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.blockCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "blocked",
        },
      ],
    });
    await ownerService.blockCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.resolveCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "resolved",
        },
      ],
    });
    await ownerService.resolveCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });

    const ownerResolutions = await ownerService.listResolvedCatalogEntries();
    const peerResolutions = await peerService.listResolvedCatalogEntries();
    const inspectedResolution =
      await ownerService.getCatalogChecklistItemResolution(
        queuedCatalogEntry.entry.id,
      );
    const appliedResolution = await peerService.applyCatalogEntry(
      queuedCatalogEntry.entry.id,
    );
    const clearedResolution =
      await ownerService.clearCatalogChecklistItemResolution(
        queuedCatalogEntry.entry.id,
      );
    const peerResolutionsAfterClear =
      await peerService.listResolvedCatalogEntries();

    expect(
      ownerResolutions.items.map(
        (item) =>
          item.blocker.progress.checklist.assignment.review.visibility
            .catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id, inlineCatalogEntry.entry.id]);
    expect(
      peerResolutions.items.map(
        (item) =>
          item.blocker.progress.checklist.assignment.review.visibility
            .catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id]);
    expect(inspectedResolution.resolution).toMatchObject({
      catalogEntryId: queuedCatalogEntry.entry.id,
      operatorId: "ops_oncall",
      resolutionNote: "Backup confirmed the follow-up closure",
      scopeId: "ops",
    });
    expect(inspectedResolution.resolution.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "resolved",
      },
      {
        item: "Close backup handoff",
        state: "unresolved",
      },
    ]);
    expect(appliedResolution.catalogEntry.entry.id).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(appliedResolution.application.savedView.id).toBe(queuedSavedView.id);
    expect(appliedResolution.application.navigation.totalSummaryCount).toBe(1);
    expect(
      appliedResolution.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.id);
    expect(clearedResolution.resolution.catalogEntryId).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(peerResolutionsAfterClear.totalCount).toBe(0);
  });

  it("verifies, lists-verified, inspects, clears, and reapplies resolved presets for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-checklist-verifications-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    let savedViewCount = 0;
    let catalogEntryCount = 0;
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
      workerId: "worker_checklist_verifications",
    });
    const ownerService = createRunrootOperatorService({
      catalogEntryIdGenerator: () =>
        `catalog_entry_verification_${++catalogEntryCount}`,
      idGenerator,
      now,
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => `saved_view_verification_${++savedViewCount}`,
      sqlitePath,
    });
    const peerService = createRunrootOperatorService({
      idGenerator,
      now,
      operatorId: "ops_backup",
      operatorScopeId: "ops",
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

    const inlineSavedView = await ownerService.saveSavedView({
      description: "Inline verification preset for owner follow-up",
      name: "Inline verification preset",
      navigation: {
        drilldown: {
          runId: inlineRun.id,
        },
        summary: {
          executionMode: "inline",
        },
      },
      refs: {
        auditViewRunId: inlineRun.id,
        drilldownRunId: inlineRun.id,
      },
    });
    const queuedSavedView = await ownerService.saveSavedView({
      description: "Queued verification preset for shared follow-up",
      name: "Queued verification preset",
      navigation: {
        drilldown: {
          workerId: "worker_checklist_verifications",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const inlineCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: inlineSavedView.id,
    });
    const queuedCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: queuedSavedView.id,
    });

    await ownerService.shareCatalogEntry(queuedCatalogEntry.entry.id);
    await ownerService.reviewCatalogEntry(inlineCatalogEntry.entry.id, {
      note: "Inline verification preset verified by the owner",
      state: "reviewed",
    });
    await peerService.reviewCatalogEntry(queuedCatalogEntry.entry.id, {
      note: "Queued verification preset ready for backup follow-up",
      state: "recommended",
    });
    await ownerService.assignCatalogEntry(inlineCatalogEntry.entry.id, {
      assigneeId: "ops_oncall",
      handoffNote: "Inline verification preset remains with the owner",
    });
    await ownerService.assignCatalogEntry(queuedCatalogEntry.entry.id, {
      assigneeId: "ops_backup",
      handoffNote: "Queued verification preset handed to the backup operator",
    });
    await ownerService.checklistCatalogEntry(inlineCatalogEntry.entry.id, {
      items: ["Confirm inline owner follow-up"],
      state: "completed",
    });
    await ownerService.checklistCatalogEntry(queuedCatalogEntry.entry.id, {
      items: ["Validate queued follow-up", "Close backup handoff"],
      state: "pending",
    });
    await ownerService.progressCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "completed",
        },
      ],
    });
    await ownerService.progressCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.blockCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "blocked",
        },
      ],
    });
    await ownerService.blockCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.resolveCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "resolved",
        },
      ],
    });
    await ownerService.resolveCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.verifyCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "verified",
        },
      ],
    });
    await ownerService.verifyCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });

    const ownerVerifications = await ownerService.listVerifiedCatalogEntries();
    const peerVerifications = await peerService.listVerifiedCatalogEntries();
    const inspectedVerification =
      await ownerService.getCatalogChecklistItemVerification(
        queuedCatalogEntry.entry.id,
      );
    const appliedVerification = await peerService.applyCatalogEntry(
      queuedCatalogEntry.entry.id,
    );
    const clearedVerification =
      await ownerService.clearCatalogChecklistItemVerification(
        queuedCatalogEntry.entry.id,
      );
    const peerVerificationsAfterClear =
      await peerService.listVerifiedCatalogEntries();

    expect(
      ownerVerifications.items.map(
        (item) =>
          item.resolution.blocker.progress.checklist.assignment.review
            .visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id, inlineCatalogEntry.entry.id]);
    expect(
      peerVerifications.items.map(
        (item) =>
          item.resolution.blocker.progress.checklist.assignment.review
            .visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id]);
    expect(inspectedVerification.verification).toMatchObject({
      catalogEntryId: queuedCatalogEntry.entry.id,
      operatorId: "ops_oncall",
      scopeId: "ops",
      verificationNote: "Backup verified the follow-up closure",
    });
    expect(inspectedVerification.verification.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "verified",
      },
      {
        item: "Close backup handoff",
        state: "unverified",
      },
    ]);
    expect(appliedVerification.catalogEntry.entry.id).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(appliedVerification.application.savedView.id).toBe(
      queuedSavedView.id,
    );
    expect(appliedVerification.application.navigation.totalSummaryCount).toBe(
      1,
    );
    expect(
      appliedVerification.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.id);
    expect(clearedVerification.verification.catalogEntryId).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(peerVerificationsAfterClear.totalCount).toBe(0);
  });

  it("records attestations, lists-attested, inspects, clears, and reapplies evidenced presets for inline and queued runs through the operator seam", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-sdk-checklist-evidence-"),
    );
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const now = createClock();
    const idGenerator = createIdGenerator();
    let savedViewCount = 0;
    let catalogEntryCount = 0;
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
      workerId: "worker_checklist_evidence",
    });
    const ownerService = createRunrootOperatorService({
      catalogEntryIdGenerator: () =>
        `catalog_entry_evidence_${++catalogEntryCount}`,
      idGenerator,
      now,
      operatorId: "ops_oncall",
      operatorScopeId: "ops",
      persistenceDriver: "sqlite",
      savedViewIdGenerator: () => `saved_view_evidence_${++savedViewCount}`,
      sqlitePath,
    });
    const peerService = createRunrootOperatorService({
      idGenerator,
      now,
      operatorId: "ops_backup",
      operatorScopeId: "ops",
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

    const inlineSavedView = await ownerService.saveSavedView({
      description: "Inline evidence preset for owner follow-up",
      name: "Inline evidence preset",
      navigation: {
        drilldown: {
          runId: inlineRun.id,
        },
        summary: {
          executionMode: "inline",
        },
      },
      refs: {
        auditViewRunId: inlineRun.id,
        drilldownRunId: inlineRun.id,
      },
    });
    const queuedSavedView = await ownerService.saveSavedView({
      description: "Queued evidence preset for shared follow-up",
      name: "Queued evidence preset",
      navigation: {
        drilldown: {
          workerId: "worker_checklist_evidence",
        },
        summary: {
          executionMode: "queued",
        },
      },
      refs: {
        auditViewRunId: queuedRun.id,
        drilldownRunId: queuedRun.id,
      },
    });
    const inlineCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: inlineSavedView.id,
    });
    const queuedCatalogEntry = await ownerService.publishCatalogEntry({
      savedViewId: queuedSavedView.id,
    });

    await ownerService.shareCatalogEntry(queuedCatalogEntry.entry.id);
    await ownerService.reviewCatalogEntry(inlineCatalogEntry.entry.id, {
      note: "Inline evidence preset verified by the owner",
      state: "reviewed",
    });
    await peerService.reviewCatalogEntry(queuedCatalogEntry.entry.id, {
      note: "Queued evidence preset ready for backup follow-up",
      state: "recommended",
    });
    await ownerService.assignCatalogEntry(inlineCatalogEntry.entry.id, {
      assigneeId: "ops_oncall",
      handoffNote: "Inline evidence preset remains with the owner",
    });
    await ownerService.assignCatalogEntry(queuedCatalogEntry.entry.id, {
      assigneeId: "ops_backup",
      handoffNote: "Queued evidence preset handed to the backup operator",
    });
    await ownerService.checklistCatalogEntry(inlineCatalogEntry.entry.id, {
      items: ["Confirm inline owner follow-up"],
      state: "completed",
    });
    await ownerService.checklistCatalogEntry(queuedCatalogEntry.entry.id, {
      items: ["Validate queued follow-up", "Close backup handoff"],
      state: "pending",
    });
    await ownerService.progressCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "completed",
        },
      ],
    });
    await ownerService.progressCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.blockCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "blocked",
        },
      ],
    });
    await ownerService.blockCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.resolveCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "resolved",
        },
      ],
    });
    await ownerService.resolveCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.verifyCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "verified",
        },
      ],
    });
    await ownerService.verifyCatalogEntry(queuedCatalogEntry.entry.id, {
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
    });
    await ownerService.recordCatalogEntryEvidence(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          references: ["run://inline-follow-up"],
        },
      ],
    });
    await ownerService.recordCatalogEntryEvidence(queuedCatalogEntry.entry.id, {
      evidenceNote: "Backup collected stable follow-up references",
      items: [
        {
          item: "Validate queued follow-up",
          references: ["run://queued-follow-up", "note://backup-closeout"],
        },
        {
          item: "Close backup handoff",
          references: ["doc://backup-handoff"],
        },
      ],
    });
    await ownerService.attestCatalogEntry(inlineCatalogEntry.entry.id, {
      items: [
        {
          item: "Confirm inline owner follow-up",
          state: "attested",
        },
      ],
    });
    await ownerService.attestCatalogEntry(queuedCatalogEntry.entry.id, {
      attestationNote: "Backup attested the stable follow-up evidence",
      items: [
        {
          item: "Validate queued follow-up",
          state: "attested",
        },
        {
          item: "Close backup handoff",
          state: "unattested",
        },
      ],
    });

    const ownerAttestations = await ownerService.listAttestedCatalogEntries();
    const peerAttestations = await peerService.listAttestedCatalogEntries();
    const inspectedAttestation =
      await ownerService.getCatalogChecklistItemAttestation(
        queuedCatalogEntry.entry.id,
      );
    const appliedAttestation = await peerService.applyCatalogEntry(
      queuedCatalogEntry.entry.id,
    );
    const clearedAttestation =
      await ownerService.clearCatalogChecklistItemAttestation(
        queuedCatalogEntry.entry.id,
      );
    const peerAttestationsAfterClear =
      await peerService.listAttestedCatalogEntries();

    expect(
      ownerAttestations.items.map(
        (item) =>
          item.evidence.verification.resolution.blocker.progress.checklist
            .assignment.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id, inlineCatalogEntry.entry.id]);
    expect(
      peerAttestations.items.map(
        (item) =>
          item.evidence.verification.resolution.blocker.progress.checklist
            .assignment.review.visibility.catalogEntry.entry.id,
      ),
    ).toEqual([queuedCatalogEntry.entry.id]);
    expect(inspectedAttestation.attestation).toMatchObject({
      catalogEntryId: queuedCatalogEntry.entry.id,
      attestationNote: "Backup attested the stable follow-up evidence",
      operatorId: "ops_oncall",
      scopeId: "ops",
    });
    expect(inspectedAttestation.attestation.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "attested",
      },
      {
        item: "Close backup handoff",
        state: "unattested",
      },
    ]);
    expect(appliedAttestation.catalogEntry.entry.id).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(appliedAttestation.application.savedView.id).toBe(
      queuedSavedView.id,
    );
    expect(appliedAttestation.application.navigation.totalSummaryCount).toBe(1);
    expect(
      appliedAttestation.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.id);
    expect(clearedAttestation.attestation.catalogEntryId).toBe(
      queuedCatalogEntry.entry.id,
    );
    expect(peerAttestationsAfterClear.totalCount).toBe(0);
  });
});
