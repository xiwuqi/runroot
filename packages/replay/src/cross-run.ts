import type { DispatchJobKind, DispatchJobStatus } from "@runroot/dispatch";
import type { RunId, RunStatus, StepId, WorkflowRun } from "@runroot/domain";
import type { ToolExecutionMode, ToolHistoryOutcome } from "@runroot/tools";

import type { RunAuditEntry, RunAuditView } from "./audit";

export interface CrossRunAuditQueryFilters {
  readonly definitionId?: string;
  readonly executionMode?: ToolExecutionMode;
  readonly runStatus?: RunStatus;
  readonly toolName?: string;
}

export interface CrossRunAuditApprovalSummary {
  readonly approvalId: string;
  readonly status: "approved" | "cancelled" | "pending" | "rejected";
  readonly stepId?: StepId;
}

export interface CrossRunAuditDispatchSummary {
  readonly dispatchJobId: string;
  readonly kind: DispatchJobKind;
  readonly status: DispatchJobStatus;
  readonly workerId?: string;
}

export interface CrossRunAuditToolSummary {
  readonly callId: string;
  readonly dispatchJobId?: string;
  readonly executionMode?: ToolExecutionMode;
  readonly outcome: ToolHistoryOutcome;
  readonly stepId?: StepId;
  readonly toolId?: string;
  readonly toolName: string;
  readonly workerId?: string;
}

export interface CrossRunAuditResult {
  readonly approvals: readonly CrossRunAuditApprovalSummary[];
  readonly definitionId: string;
  readonly definitionName: string;
  readonly dispatchJobs: readonly CrossRunAuditDispatchSummary[];
  readonly executionModes: readonly ToolExecutionMode[];
  readonly lastOccurredAt?: string;
  readonly runId: RunId;
  readonly runStatus: RunStatus;
  readonly stepIds: readonly StepId[];
  readonly summary: string;
  readonly toolCalls: readonly CrossRunAuditToolSummary[];
  readonly updatedAt: string;
  readonly workerIds: readonly string[];
}

export interface CrossRunAuditResults {
  readonly filters: CrossRunAuditQueryFilters;
  readonly results: readonly CrossRunAuditResult[];
  readonly totalCount: number;
}

export function projectCrossRunAuditResult(
  run: WorkflowRun,
  audit: RunAuditView,
): CrossRunAuditResult {
  if (audit.runId !== run.id) {
    throw new Error(
      `Cross-run audit query received audit view for run "${audit.runId}" while summarizing run "${run.id}".`,
    );
  }

  const approvals = summarizeApprovals(audit.entries);
  const dispatchJobs = summarizeDispatchJobs(audit.entries);
  const toolCalls = summarizeToolCalls(audit.entries);
  const executionModes = toSortedValues(
    toolCalls
      .map((toolCall) => toolCall.executionMode)
      .filter(
        (value): value is ToolExecutionMode =>
          value === "inline" || value === "queued",
      ),
  );
  const stepIds = toSortedValues(
    audit.entries
      .map((entry) => entry.correlation.stepId)
      .filter((value): value is StepId => typeof value === "string"),
  );
  const workerIds = toSortedValues([
    ...dispatchJobs
      .map((dispatchJob) => dispatchJob.workerId)
      .filter((value): value is string => typeof value === "string"),
    ...toolCalls
      .map((toolCall) => toolCall.workerId)
      .filter((value): value is string => typeof value === "string"),
  ]);
  const lastOccurredAt = audit.entries.at(-1)?.occurredAt;

  return {
    approvals,
    definitionId: run.definitionId,
    definitionName: run.definitionName,
    dispatchJobs,
    executionModes,
    ...(lastOccurredAt ? { lastOccurredAt } : {}),
    runId: run.id,
    runStatus: run.status,
    stepIds,
    summary: summarizeCrossRunAuditResult(
      run,
      approvals.length,
      dispatchJobs.length,
      toolCalls.length,
    ),
    toolCalls,
    updatedAt: run.updatedAt,
    workerIds,
  };
}

export function matchesCrossRunAuditFilters(
  result: CrossRunAuditResult,
  filters: CrossRunAuditQueryFilters,
): boolean {
  if (filters.executionMode) {
    const matchesExecutionMode = result.executionModes.includes(
      filters.executionMode,
    );

    if (!matchesExecutionMode) {
      return false;
    }
  }

  if (filters.toolName) {
    const matchesToolName = result.toolCalls.some(
      (toolCall) => toolCall.toolName === filters.toolName,
    );

    if (!matchesToolName) {
      return false;
    }
  }

  return true;
}

export function compareCrossRunAuditResults(
  left: CrossRunAuditResult,
  right: CrossRunAuditResult,
): number {
  return (
    (right.lastOccurredAt ?? right.updatedAt).localeCompare(
      left.lastOccurredAt ?? left.updatedAt,
    ) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.runId.localeCompare(right.runId)
  );
}

function summarizeApprovals(
  entries: readonly RunAuditEntry[],
): readonly CrossRunAuditApprovalSummary[] {
  const approvals = new Map<string, CrossRunAuditApprovalSummary>();

  for (const entry of entries) {
    if (
      entry.kind !== "replay-event" ||
      entry.fact.sourceOfTruth !== "runtime-event" ||
      !entry.correlation.approvalId
    ) {
      continue;
    }

    const payload = entry.fact.payload as { status?: string };
    const status =
      payload.status === "approved" ||
      payload.status === "cancelled" ||
      payload.status === "pending" ||
      payload.status === "rejected"
        ? payload.status
        : undefined;

    if (!status) {
      continue;
    }

    approvals.set(entry.correlation.approvalId, {
      approvalId: entry.correlation.approvalId,
      ...(entry.correlation.stepId ? { stepId: entry.correlation.stepId } : {}),
      status,
    });
  }

  return [...approvals.values()].sort((left, right) =>
    left.approvalId.localeCompare(right.approvalId),
  );
}

function summarizeDispatchJobs(
  entries: readonly RunAuditEntry[],
): readonly CrossRunAuditDispatchSummary[] {
  const dispatchJobs = new Map<string, CrossRunAuditDispatchSummary>();

  for (const entry of entries) {
    if (entry.fact.sourceOfTruth !== "dispatch") {
      continue;
    }

    dispatchJobs.set(entry.fact.dispatchJobId, {
      dispatchJobId: entry.fact.dispatchJobId,
      kind: entry.fact.dispatchKind,
      status: entry.fact.dispatchStatus,
      ...(entry.fact.workerId ? { workerId: entry.fact.workerId } : {}),
    });
  }

  return [...dispatchJobs.values()].sort((left, right) =>
    left.dispatchJobId.localeCompare(right.dispatchJobId),
  );
}

function summarizeToolCalls(
  entries: readonly RunAuditEntry[],
): readonly CrossRunAuditToolSummary[] {
  return entries
    .flatMap((entry) => {
      if (entry.fact.sourceOfTruth !== "tool-history") {
        return [];
      }

      return [
        {
          callId: entry.fact.callId,
          ...(entry.correlation.dispatchJobId
            ? { dispatchJobId: entry.correlation.dispatchJobId }
            : {}),
          ...(entry.fact.executionMode
            ? { executionMode: entry.fact.executionMode }
            : {}),
          outcome: entry.fact.outcome,
          ...(entry.correlation.stepId
            ? { stepId: entry.correlation.stepId }
            : {}),
          ...(entry.correlation.toolId
            ? { toolId: entry.correlation.toolId }
            : {}),
          toolName: entry.fact.toolName,
          ...(entry.correlation.workerId
            ? { workerId: entry.correlation.workerId }
            : {}),
        } satisfies CrossRunAuditToolSummary,
      ];
    })
    .sort((left, right) => left.callId.localeCompare(right.callId));
}

function summarizeCrossRunAuditResult(
  run: WorkflowRun,
  approvalCount: number,
  dispatchJobCount: number,
  toolCallCount: number,
): string {
  return `${run.definitionName} (${run.status}) with ${approvalCount} approval fact(s), ${dispatchJobCount} dispatch job(s), and ${toolCallCount} tool outcome(s).`;
}

function toSortedValues<TValue extends string>(
  values: readonly TValue[],
): readonly TValue[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
