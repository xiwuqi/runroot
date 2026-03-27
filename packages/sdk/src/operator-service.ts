import { resolve } from "node:path";

import type { ApprovalActor, ApprovalRequest } from "@runroot/approvals";
import {
  type ApprovalDecisionOutcome,
  RuntimeEngine,
  RuntimeExecutionError,
} from "@runroot/core-runtime";
import type { JsonValue, WorkflowRun } from "@runroot/domain";
import {
  createFileRuntimePersistence,
  type RuntimePersistence,
} from "@runroot/persistence";
import {
  createRunTimelineQuery,
  type RunTimeline,
  type RunTimelineQuery,
} from "@runroot/replay";
import {
  createTemplateRuntimeBundle,
  type TemplateCatalog,
  TemplateNotFoundError,
  type WorkflowTemplate,
  type WorkflowTemplateDescriptor,
} from "@runroot/templates";
import { validateToolValue } from "@runroot/tools";

import {
  OperatorConflictError,
  OperatorInputError,
  OperatorNotFoundError,
} from "./errors";

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
  decideApproval(
    approvalId: string,
    input: DecideApprovalInput,
  ): Promise<ApprovalDecisionOutcome>;
  getApproval(approvalId: string): Promise<ApprovalRequest>;
  getApprovals(runId: string): Promise<readonly ApprovalRequest[]>;
  getPendingApprovals(): Promise<readonly PendingApprovalSummary[]>;
  getRun(runId: string): Promise<WorkflowRun>;
  getTimeline(runId: string): Promise<RunTimeline>;
  getWorkspacePath(): string;
  listRuns(): Promise<readonly WorkflowRun[]>;
  listTemplates(): readonly WorkflowTemplateDescriptor[];
  resumeRun(runId: string): Promise<WorkflowRun>;
  startRun(input: StartTemplateRunInput): Promise<WorkflowRun>;
}

export interface RunrootOperatorServiceOptions {
  readonly approvalIdGenerator?: () => string;
  readonly idGenerator?: (prefix: "run" | "step") => string;
  readonly now?: () => string;
  readonly persistence?: RuntimePersistence;
  readonly templates?: TemplateCatalog;
  readonly workspacePath?: string;
}

export function createRunrootOperatorService(
  options: RunrootOperatorServiceOptions = {},
): RunrootOperatorService {
  const templateRuntime = createTemplateRuntimeBundle();
  const templates = options.templates ?? templateRuntime.templates;
  const persistence =
    options.persistence ??
    createFileRuntimePersistence({
      filePath: resolveWorkspacePath(options.workspacePath),
    });
  const runtime = new RuntimeEngine({
    ...(options.approvalIdGenerator
      ? { approvalIdGenerator: options.approvalIdGenerator }
      : {}),
    ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
    ...(options.now ? { now: options.now } : {}),
    persistence,
    toolInvoker: templateRuntime.toolInvoker,
  });
  const replay = createRunTimelineQuery({
    listByRunId: (runId) => runtime.getRunEvents(runId),
  });
  const workspacePath = resolveWorkspacePath(options.workspacePath);

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

    async getTimeline(runId) {
      await requireRun(runtime, runId);

      return replay.getTimeline(runId);
    },

    getWorkspacePath() {
      return workspacePath;
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

export function resolveWorkspacePath(workspacePath?: string): string {
  return resolve(
    workspacePath ??
      process.env.RUNROOT_WORKSPACE_PATH ??
      ".runroot/workspace.json",
  );
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
