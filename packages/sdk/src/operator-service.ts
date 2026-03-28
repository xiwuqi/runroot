import type { ApprovalActor, ApprovalRequest } from "@runroot/approvals";
import {
  type ExecutionMode,
  type PersistenceDriver,
  resolveExecutionMode,
  resolvePersistenceConfig,
  resolveWorkspacePath,
} from "@runroot/config";
import {
  type ApprovalDecisionOutcome,
  RuntimeEngine,
  RuntimeExecutionError,
} from "@runroot/core-runtime";
import type { DispatchQueue } from "@runroot/dispatch";
import type { JsonValue, WorkflowRun } from "@runroot/domain";
import type { RunrootLogger, RunrootTracer } from "@runroot/observability";
import {
  createConfiguredDispatchQueue,
  createConfiguredRuntimePersistence,
  createConfiguredToolHistoryStore,
  type RuntimePersistence,
} from "@runroot/persistence";
import {
  createRunAuditQuery,
  createRunTimelineQuery,
  type RunAuditView,
  type RunTimeline,
  type RunTimelineQuery,
} from "@runroot/replay";
import {
  type CreateTemplateRuntimeBundleOptions,
  createTemplateRuntimeBundle,
  type TemplateCatalog,
  TemplateNotFoundError,
  type WorkflowTemplate,
  type WorkflowTemplateDescriptor,
} from "@runroot/templates";
import {
  type ToolHistoryEntry,
  type ToolHistoryStore,
  toolTelemetryMetadataKeys,
  validateToolValue,
  withToolInvocationMetadata,
} from "@runroot/tools";

import {
  OperatorConflictError,
  OperatorInputError,
  OperatorNotFoundError,
} from "./errors";
import { createToolTelemetryObserver } from "./tool-telemetry";

export interface StartTemplateRunInput {
  readonly input: JsonValue;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly templateId: string;
}

export interface DecideApprovalInput {
  readonly actor?: ApprovalActor;
  readonly decision: "approved" | "cancelled" | "rejected";
  readonly note?: string;
}

export interface PendingApprovalSummary {
  readonly approval: ApprovalRequest;
  readonly run: WorkflowRun;
}

export interface RunrootOperatorService {
  getAuditView(runId: string): Promise<RunAuditView>;
  decideApproval(
    approvalId: string,
    input: DecideApprovalInput,
  ): Promise<ApprovalDecisionOutcome>;
  getApproval(approvalId: string): Promise<ApprovalRequest>;
  getApprovals(runId: string): Promise<readonly ApprovalRequest[]>;
  getPendingApprovals(): Promise<readonly PendingApprovalSummary[]>;
  getRun(runId: string): Promise<WorkflowRun>;
  getToolHistory(runId: string): Promise<readonly ToolHistoryEntry[]>;
  getTimeline(runId: string): Promise<RunTimeline>;
  getWorkspacePath(): string;
  listRuns(): Promise<readonly WorkflowRun[]>;
  listTemplates(): readonly WorkflowTemplateDescriptor[];
  resumeRun(runId: string): Promise<WorkflowRun>;
  startRun(input: StartTemplateRunInput): Promise<WorkflowRun>;
}

export interface RunrootOperatorServiceOptions {
  readonly approvalIdGenerator?: () => string;
  readonly databaseUrl?: string;
  readonly dispatchQueue?: DispatchQueue;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly executionMode?: ExecutionMode;
  readonly idGenerator?: (prefix: "run" | "step") => string;
  readonly logger?: RunrootLogger;
  readonly now?: () => string;
  readonly persistence?: RuntimePersistence;
  readonly persistenceDriver?: PersistenceDriver;
  readonly sqlitePath?: string;
  readonly templates?: TemplateCatalog;
  readonly toolHistory?: ToolHistoryStore;
  readonly tracer?: RunrootTracer;
  readonly workspacePath?: string;
}

export function createRunrootOperatorService(
  options: RunrootOperatorServiceOptions = {},
): RunrootOperatorService {
  const now = options.now ?? (() => new Date().toISOString());
  const persistenceConfig = resolvePersistenceConfig({
    ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
    ...(options.env ? { env: options.env } : {}),
    ...(options.persistenceDriver ? { driver: options.persistenceDriver } : {}),
    ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
    ...(options.workspacePath ? { workspacePath: options.workspacePath } : {}),
  });
  const persistence =
    options.persistence ??
    createConfiguredRuntimePersistence({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const toolHistory =
    options.toolHistory ??
    createConfiguredToolHistoryStore({
      ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.persistenceDriver
        ? { driver: options.persistenceDriver }
        : {}),
      ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
      ...(options.workspacePath
        ? { workspacePath: options.workspacePath }
        : {}),
    });
  const templateRuntimeOptions: CreateTemplateRuntimeBundleOptions = {
    toolObserver: createToolTelemetryObserver({
      history: toolHistory,
      ...(options.logger ? { logger: options.logger } : {}),
      surface: "operator",
      ...(options.tracer ? { tracer: options.tracer } : {}),
    }),
  };
  const templateRuntime = createTemplateRuntimeBundle(templateRuntimeOptions);
  const templates = options.templates ?? templateRuntime.templates;
  const executionMode = resolveExecutionMode({
    ...(options.env ? { env: options.env } : {}),
    ...(options.executionMode ? { executionMode: options.executionMode } : {}),
  });
  const dispatchQueue =
    executionMode === "queued"
      ? (options.dispatchQueue ??
        createConfiguredDispatchQueue({
          ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
          ...(options.env ? { env: options.env } : {}),
          ...(options.persistenceDriver
            ? { driver: options.persistenceDriver }
            : {}),
          ...(options.sqlitePath ? { sqlitePath: options.sqlitePath } : {}),
          ...(options.workspacePath
            ? { workspacePath: options.workspacePath }
            : {}),
        }))
      : undefined;
  const runtime = new RuntimeEngine({
    ...(options.approvalIdGenerator
      ? { approvalIdGenerator: options.approvalIdGenerator }
      : {}),
    ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
    now,
    persistence,
    toolInvoker: withToolInvocationMetadata(templateRuntime.toolInvoker, {
      [toolTelemetryMetadataKeys.executionMode]: "inline",
    }),
  });
  const replay = createRunTimelineQuery({
    listByRunId: (runId) => runtime.getRunEvents(runId),
  });
  const audit = createRunAuditQuery({
    listByRunId: (runId) => runtime.getRunEvents(runId),
    async listDispatchJobsByRunId(runId) {
      return dispatchQueue ? dispatchQueue.listByRunId(runId) : [];
    },
    listToolHistoryByRunId: (runId) => toolHistory.listByRunId(runId),
  });
  const persistenceLocation = persistenceConfig.location;

  return {
    async decideApproval(approvalId, input) {
      const approval = await runtime.getApproval(approvalId);

      if (!approval) {
        throw new OperatorNotFoundError("approval", approvalId);
      }

      try {
        return await runtime.decideApproval(approvalId, input);
      } catch (error) {
        throw normalizeOperatorError(error);
      }
    },

    async getApproval(approvalId) {
      const approval = await runtime.getApproval(approvalId);

      if (!approval) {
        throw new OperatorNotFoundError("approval", approvalId);
      }

      return approval;
    },

    async getApprovals(runId) {
      await requireRun(runtime, runId);

      return runtime.getApprovals(runId);
    },

    async getAuditView(runId) {
      await requireRun(runtime, runId);

      return audit.getAuditView(runId);
    },

    async getPendingApprovals() {
      const runs = await runtime.listRuns();
      const pendingApprovals: PendingApprovalSummary[] = [];

      for (const run of runs) {
        const approval = await runtime.getPendingApproval(run.id);

        if (approval) {
          pendingApprovals.push({
            approval,
            run,
          });
        }
      }

      return pendingApprovals;
    },

    async getRun(runId) {
      return requireRun(runtime, runId);
    },

    async getToolHistory(runId) {
      await requireRun(runtime, runId);

      return toolHistory.listByRunId(runId);
    },

    async getTimeline(runId) {
      await requireRun(runtime, runId);

      return replay.getTimeline(runId);
    },

    getWorkspacePath() {
      return persistenceLocation;
    },

    async listRuns() {
      return runtime.listRuns();
    },

    listTemplates() {
      return templates.list().map((template) => template.descriptor);
    },

    async resumeRun(runId) {
      const run = await requireRun(runtime, runId);
      const template = templates.get(run.definitionId);

      if (!template) {
        throw new OperatorNotFoundError("template", run.definitionId);
      }

      try {
        if (executionMode === "queued") {
          if (run.status !== "paused") {
            return run;
          }

          const pendingApproval = await runtime.getPendingApproval(run.id);

          if (pendingApproval) {
            throw new RuntimeExecutionError(
              `Run "${run.id}" is waiting on approval "${pendingApproval.id}" and cannot resume until the decision is recorded.`,
            );
          }

          await dispatchQueue?.enqueue({
            definitionId: template.definition.id,
            enqueuedAt: now(),
            kind: "resume_run",
            runId,
          });

          return runtime.queueResumeRun(template.definition, runId);
        }

        return await runtime.resumeRun(template.definition, runId);
      } catch (error) {
        throw normalizeOperatorError(error);
      }
    },

    async startRun(input) {
      const template = requireTemplate(templates, input.templateId);
      assertValidTemplateInput(template, input.input);
      const run = await runtime.createRun(template.definition, input.input, {
        metadata: {
          ...(input.metadata ?? {}),
          templateId: template.descriptor.id,
        },
      });

      if (executionMode === "queued") {
        await dispatchQueue?.enqueue({
          definitionId: template.definition.id,
          enqueuedAt: now(),
          kind: "start_run",
          runId: run.id,
        });

        return runtime.queueRun(template.definition, run.id);
      }

      return runtime.executeRun(template.definition, run.id);
    },
  };
}

export function createRunTimelineService(
  reader: RunTimelineQuery,
): Pick<RunrootOperatorService, "getTimeline"> {
  return {
    getTimeline(runId) {
      return reader.getTimeline(runId);
    },
  };
}

function requireTemplate(
  templates: TemplateCatalog,
  templateId: string,
): WorkflowTemplate {
  try {
    return templates.require(templateId);
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      throw new OperatorNotFoundError("template", templateId);
    }

    throw error;
  }
}

function assertValidTemplateInput(
  template: WorkflowTemplate,
  input: JsonValue,
): void {
  const issues = validateToolValue(
    input,
    template.descriptor.inputSchema,
    "templateInput",
  );

  if (issues.length > 0) {
    throw new OperatorInputError(
      `Template "${template.descriptor.id}" received invalid input: ${issues.join(" ")}`,
    );
  }
}

async function requireRun(
  runtime: RuntimeEngine,
  runId: string,
): Promise<WorkflowRun> {
  const run = await runtime.getRun(runId);

  if (!run) {
    throw new OperatorNotFoundError("run", runId);
  }

  return run;
}

function normalizeOperatorError(error: unknown): Error {
  if (
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    return error;
  }

  if (error instanceof RuntimeExecutionError) {
    return new OperatorConflictError(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export { resolveWorkspacePath };
