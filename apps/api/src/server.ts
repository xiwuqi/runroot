import cors from "@fastify/cors";
import { approvalsPackageBoundary } from "@runroot/approvals";
import { cliPackageBoundary } from "@runroot/cli";
import { projectMetadata, requiredQualityCommands } from "@runroot/config";
import { coreRuntimePackageBoundary } from "@runroot/core-runtime";
import { dispatchPackageBoundary } from "@runroot/dispatch";
import {
  domainPackageBoundary,
  type JsonValue,
  type RunStatus,
} from "@runroot/domain";
import { eventsPackageBoundary } from "@runroot/events";
import { mcpPackageBoundary } from "@runroot/mcp";
import { observabilityPackageBoundary } from "@runroot/observability";
import { persistencePackageBoundary } from "@runroot/persistence";
import { replayPackageBoundary } from "@runroot/replay";
import {
  createRunrootOperatorService,
  OperatorConflictError,
  OperatorError,
  OperatorInputError,
  OperatorNotFoundError,
  type RunrootOperatorService,
  sdkPackageBoundary,
} from "@runroot/sdk";
import { templatesPackageBoundary } from "@runroot/templates";
import { toolsPackageBoundary } from "@runroot/tools";
import Fastify from "fastify";

export const packageBoundaries = [
  domainPackageBoundary,
  coreRuntimePackageBoundary,
  dispatchPackageBoundary,
  persistencePackageBoundary,
  eventsPackageBoundary,
  toolsPackageBoundary,
  mcpPackageBoundary,
  approvalsPackageBoundary,
  replayPackageBoundary,
  observabilityPackageBoundary,
  sdkPackageBoundary,
  cliPackageBoundary,
  templatesPackageBoundary,
] as const;

function findDuplicateBoundaryNames(names: readonly string[]): string[] {
  const counts = new Map<string, number>();

  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort();
}

export interface BuildServerOptions {
  readonly operator?: RunrootOperatorService;
}

export function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });
  const operator =
    options.operator ??
    createRunrootOperatorService({
      ...(process.env.RUNROOT_WORKSPACE_PATH
        ? {
            workspacePath: process.env.RUNROOT_WORKSPACE_PATH,
          }
        : {}),
    });

  app.register(cors, {
    origin: true,
  });

  app.get("/healthz", async () => ({
    status: "ok",
    project: projectMetadata.name,
    phase: projectMetadata.currentPhase,
  }));

  app.get("/manifest/project", async () => ({
    project: projectMetadata,
    commands: requiredQualityCommands,
    workspacePath: operator.getWorkspacePath(),
  }));

  app.get("/manifest/packages", async () => ({
    packages: packageBoundaries,
    integrity: {
      duplicateNames: findDuplicateBoundaryNames(
        packageBoundaries.map((boundary) => boundary.name),
      ),
    },
  }));

  app.get("/templates", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      templates: operator.listTemplates(),
    })),
  );

  app.get("/runs", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      runs: await operator.listRuns(),
    })),
  );

  app.get("/audit/runs", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const query = request.query as {
        readonly definitionId?: string;
        readonly executionMode?: "inline" | "queued";
        readonly runStatus?: string;
        readonly toolName?: string;
      };
      const runStatus = readRunStatusQuery(query.runStatus);

      return {
        audit: await operator.listAuditResults({
          ...(query.definitionId ? { definitionId: query.definitionId } : {}),
          ...(query.executionMode
            ? { executionMode: query.executionMode }
            : {}),
          ...(runStatus ? { runStatus } : {}),
          ...(query.toolName ? { toolName: query.toolName } : {}),
        }),
      };
    }),
  );

  app.get("/audit/drilldowns", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const query = request.query as {
        readonly approvalId?: string;
        readonly dispatchJobId?: string;
        readonly runId?: string;
        readonly stepId?: string;
        readonly toolCallId?: string;
        readonly toolId?: string;
        readonly workerId?: string;
      };

      return {
        audit: await operator.listAuditDrilldowns({
          ...(query.approvalId ? { approvalId: query.approvalId } : {}),
          ...(query.dispatchJobId
            ? { dispatchJobId: query.dispatchJobId }
            : {}),
          ...(query.runId ? { runId: query.runId } : {}),
          ...(query.stepId ? { stepId: query.stepId } : {}),
          ...(query.toolCallId ? { toolCallId: query.toolCallId } : {}),
          ...(query.toolId ? { toolId: query.toolId } : {}),
          ...(query.workerId ? { workerId: query.workerId } : {}),
        }),
      };
    }),
  );

  app.get("/audit/navigation", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const query = request.query as {
        readonly approvalId?: string;
        readonly definitionId?: string;
        readonly dispatchJobId?: string;
        readonly executionMode?: "inline" | "queued";
        readonly runId?: string;
        readonly runStatus?: string;
        readonly stepId?: string;
        readonly toolCallId?: string;
        readonly toolId?: string;
        readonly toolName?: string;
        readonly workerId?: string;
      };
      const runStatus = readRunStatusQuery(query.runStatus);

      return {
        audit: await operator.getAuditNavigation({
          drilldown: {
            ...(query.approvalId ? { approvalId: query.approvalId } : {}),
            ...(query.dispatchJobId
              ? { dispatchJobId: query.dispatchJobId }
              : {}),
            ...(query.runId ? { runId: query.runId } : {}),
            ...(query.stepId ? { stepId: query.stepId } : {}),
            ...(query.toolCallId ? { toolCallId: query.toolCallId } : {}),
            ...(query.toolId ? { toolId: query.toolId } : {}),
            ...(query.workerId ? { workerId: query.workerId } : {}),
          },
          summary: {
            ...(query.definitionId ? { definitionId: query.definitionId } : {}),
            ...(query.executionMode
              ? { executionMode: query.executionMode }
              : {}),
            ...(runStatus ? { runStatus } : {}),
            ...(query.toolName ? { toolName: query.toolName } : {}),
          },
        }),
      };
    }),
  );

  app.get("/audit/saved-views", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      savedViews: await operator.listSavedViews(),
    })),
  );

  app.get("/audit/catalog", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      catalog: await operator.listCatalogEntries(),
    })),
  );

  app.post("/audit/saved-views", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const body = request.body as {
        readonly description?: string;
        readonly kind?: "operator-preset" | "saved-view";
        readonly name?: string;
        readonly navigation?: {
          readonly drilldown?: {
            readonly approvalId?: string;
            readonly dispatchJobId?: string;
            readonly runId?: string;
            readonly stepId?: string;
            readonly toolCallId?: string;
            readonly toolId?: string;
            readonly workerId?: string;
          };
          readonly summary?: {
            readonly definitionId?: string;
            readonly executionMode?: string;
            readonly runStatus?: string;
            readonly toolName?: string;
          };
        };
        readonly refs?: {
          readonly auditViewRunId?: string;
          readonly drilldownRunId?: string;
        };
      };

      if (!body?.name) {
        throw new OperatorInputError("name is required.");
      }

      const kind = body.kind ? readSavedViewKind(body.kind) : undefined;
      const navigation = body.navigation
        ? readSavedViewNavigation(body.navigation)
        : undefined;
      const refs = body.refs ? readSavedViewRefs(body.refs) : undefined;

      const savedView = await operator.saveSavedView({
        ...(body.description ? { description: body.description } : {}),
        ...(kind ? { kind } : {}),
        name: body.name,
        ...(navigation ? { navigation } : {}),
        ...(refs ? { refs } : {}),
      });

      reply.code(201);

      return {
        savedView,
      };
    }),
  );

  app.post("/audit/catalog", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const body = request.body as {
        readonly description?: string;
        readonly name?: string;
        readonly savedViewId?: string;
      };

      if (!body?.savedViewId) {
        throw new OperatorInputError("savedViewId is required.");
      }

      const catalogEntry = await operator.publishCatalogEntry({
        ...(body.description ? { description: body.description } : {}),
        ...(body.name ? { name: body.name } : {}),
        savedViewId: body.savedViewId,
      });

      reply.code(201);

      return {
        catalogEntry,
      };
    }),
  );

  app.get("/audit/saved-views/:savedViewId", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly savedViewId: string;
      };

      return {
        savedView: await operator.getSavedView(params.savedViewId),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        catalogEntry: await operator.getCatalogEntry(params.catalogEntryId),
      };
    }),
  );

  app.get("/audit/saved-views/:savedViewId/apply", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly savedViewId: string;
      };

      return {
        application: await operator.applySavedView(params.savedViewId),
      };
    }),
  );

  app.post("/audit/catalog/:catalogEntryId/archive", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        catalogEntry: await operator.archiveCatalogEntry(params.catalogEntryId),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/apply", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        application: await operator.applyCatalogEntry(params.catalogEntryId),
      };
    }),
  );

  app.post("/runs", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const body = request.body as {
        readonly input?: unknown;
        readonly metadata?: Readonly<Record<string, string>>;
        readonly templateId?: string;
      };

      if (!body?.templateId) {
        throw new OperatorInputError("templateId is required.");
      }

      if (body.input === undefined) {
        throw new OperatorInputError("input is required.");
      }

      const run = await operator.startRun({
        input: body.input as JsonValue,
        ...(body.metadata ? { metadata: body.metadata } : {}),
        templateId: body.templateId,
      });

      reply.code(201);

      return {
        run,
      };
    }),
  );

  app.get("/runs/:runId", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        run: await operator.getRun(params.runId),
      };
    }),
  );

  app.get("/runs/:runId/approvals", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        approvals: await operator.getApprovals(params.runId),
      };
    }),
  );

  app.post("/runs/:runId/resume", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        run: await operator.resumeRun(params.runId),
      };
    }),
  );

  app.get("/runs/:runId/timeline", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        timeline: await operator.getTimeline(params.runId),
      };
    }),
  );

  app.get("/runs/:runId/audit", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        audit: await operator.getAuditView(params.runId),
      };
    }),
  );

  app.get("/runs/:runId/tool-history", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        entries: await operator.getToolHistory(params.runId),
      };
    }),
  );

  app.get("/approvals/pending", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      approvals: await operator.getPendingApprovals(),
    })),
  );

  app.get("/approvals/:approvalId", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly approvalId: string;
      };

      return {
        approval: await operator.getApproval(params.approvalId),
      };
    }),
  );

  app.post("/approvals/:approvalId/decision", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly approvalId: string;
      };
      const body = request.body as {
        readonly actorDisplayName?: string;
        readonly actorId?: string;
        readonly decision?: "approved" | "cancelled" | "rejected";
        readonly note?: string;
      };

      if (!body?.decision) {
        throw new OperatorInputError("decision is required.");
      }

      const outcome = await operator.decideApproval(params.approvalId, {
        ...(body.actorId
          ? {
              actor: {
                ...(body.actorDisplayName
                  ? { displayName: body.actorDisplayName }
                  : {}),
                id: body.actorId,
              },
            }
          : {}),
        decision: body.decision,
        ...(body.note === undefined ? {} : { note: body.note }),
      });

      return outcome;
    }),
  );

  return app;
}

async function handleOperatorResponse<TValue>(
  reply: {
    code(statusCode: number): typeof reply;
  },
  task: () => Promise<TValue>,
): Promise<TValue> {
  try {
    return await task();
  } catch (error) {
    throw mapOperatorError(reply, error);
  }
}

function mapOperatorError(
  reply: {
    code(statusCode: number): typeof reply;
  },
  error: unknown,
): Error {
  if (error instanceof OperatorError) {
    reply.code(error.statusCode);

    return error;
  }

  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    reply.code(error.statusCode);

    return error;
  }

  return error instanceof Error ? error : new Error(String(error));
}

function readRunStatusQuery(value: string | undefined): RunStatus | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "cancelled":
    case "failed":
    case "paused":
    case "pending":
    case "queued":
    case "running":
    case "succeeded":
      return value;
    default:
      throw new OperatorInputError(
        "runStatus must be one of cancelled|failed|paused|pending|queued|running|succeeded.",
      );
  }
}

function readExecutionModeValue(
  value: string | undefined,
  fieldName: string,
): "inline" | "queued" | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "inline":
    case "queued":
      return value;
    default:
      throw new OperatorInputError(
        `${fieldName} must be one of inline|queued.`,
      );
  }
}

function readSavedViewKind(
  value: string | undefined,
): "operator-preset" | "saved-view" | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "operator-preset":
    case "saved-view":
      return value;
    default:
      throw new OperatorInputError(
        "kind must be one of saved-view|operator-preset.",
      );
  }
}

function readSavedViewNavigation(input: {
  readonly drilldown?: {
    readonly approvalId?: string;
    readonly dispatchJobId?: string;
    readonly runId?: string;
    readonly stepId?: string;
    readonly toolCallId?: string;
    readonly toolId?: string;
    readonly workerId?: string;
  };
  readonly summary?: {
    readonly definitionId?: string;
    readonly executionMode?: string;
    readonly runStatus?: string;
    readonly toolName?: string;
  };
}) {
  const summary = input.summary ?? {};
  const drilldown = input.drilldown ?? {};
  const runStatus = readRunStatusQuery(summary.runStatus);
  const executionMode = readExecutionModeValue(
    summary.executionMode,
    "navigation.summary.executionMode",
  );

  return {
    drilldown: {
      ...(drilldown.approvalId ? { approvalId: drilldown.approvalId } : {}),
      ...(drilldown.dispatchJobId
        ? { dispatchJobId: drilldown.dispatchJobId }
        : {}),
      ...(drilldown.runId ? { runId: drilldown.runId } : {}),
      ...(drilldown.stepId ? { stepId: drilldown.stepId } : {}),
      ...(drilldown.toolCallId ? { toolCallId: drilldown.toolCallId } : {}),
      ...(drilldown.toolId ? { toolId: drilldown.toolId } : {}),
      ...(drilldown.workerId ? { workerId: drilldown.workerId } : {}),
    },
    summary: {
      ...(summary.definitionId ? { definitionId: summary.definitionId } : {}),
      ...(executionMode ? { executionMode } : {}),
      ...(runStatus ? { runStatus } : {}),
      ...(summary.toolName ? { toolName: summary.toolName } : {}),
    },
  };
}

function readSavedViewRefs(input: {
  readonly auditViewRunId?: string;
  readonly drilldownRunId?: string;
}) {
  return {
    ...(input.auditViewRunId ? { auditViewRunId: input.auditViewRunId } : {}),
    ...(input.drilldownRunId ? { drilldownRunId: input.drilldownRunId } : {}),
  };
}
