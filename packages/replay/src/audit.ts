import type {
  DispatchJob,
  DispatchJobKind,
  DispatchJobStatus,
} from "@runroot/dispatch";
import type { RunId, StepId } from "@runroot/domain";
import type { RuntimeEvent, RuntimeEventName } from "@runroot/events";
import type {
  ToolExecutionMode,
  ToolHistoryEntry,
  ToolHistoryOutcome,
} from "@runroot/tools";

export type RunAuditEntryKind =
  | "dispatch-claimed"
  | "dispatch-completed"
  | "dispatch-enqueued"
  | "dispatch-failed"
  | "replay-event"
  | "tool-outcome";

export interface RunAuditEntryCorrelation {
  readonly approvalId?: string;
  readonly dispatchJobId?: string;
  readonly runId: RunId;
  readonly stepId?: StepId;
  readonly toolCallId?: string;
  readonly toolId?: string;
  readonly workerId?: string;
}

export interface RunAuditEventFact {
  readonly eventId: string;
  readonly eventName: RuntimeEventName;
  readonly payload: RuntimeEvent["payload"];
  readonly sequence: number;
  readonly sourceOfTruth: "runtime-event";
}

export interface RunAuditDispatchFact {
  readonly attempts: number;
  readonly dispatchJobId: string;
  readonly dispatchKind: DispatchJobKind;
  readonly dispatchStatus: DispatchJobStatus;
  readonly sourceOfTruth: "dispatch";
  readonly workerId?: string;
}

export interface RunAuditToolFact {
  readonly attempt?: number;
  readonly callId: string;
  readonly executionMode?: ToolExecutionMode;
  readonly inputSummary: string;
  readonly outcome: ToolHistoryOutcome;
  readonly outcomeDetail?: string;
  readonly outputSummary?: string;
  readonly source: string;
  readonly sourceOfTruth: "tool-history";
  readonly toolName: string;
  readonly toolSource: string;
}

export interface RunAuditEntry {
  readonly correlation: RunAuditEntryCorrelation;
  readonly detail?: string;
  readonly fact: RunAuditDispatchFact | RunAuditEventFact | RunAuditToolFact;
  readonly kind: RunAuditEntryKind;
  readonly occurredAt: string;
  readonly summary: string;
}

export interface RunAuditView {
  readonly entries: readonly RunAuditEntry[];
  readonly runId: RunId;
}

export function projectRunAuditView(
  runId: RunId,
  input: {
    readonly dispatchJobs: readonly DispatchJob[];
    readonly events: readonly RuntimeEvent[];
    readonly toolHistory: readonly ToolHistoryEntry[];
  },
): RunAuditView {
  const entries = [
    ...input.events.map((event) => createReplayEntry(runId, event)),
    ...input.dispatchJobs.flatMap((job) => createDispatchEntries(runId, job)),
    ...input.toolHistory.map((entry) => createToolEntry(runId, entry)),
  ].sort(compareAuditEntries);

  return {
    entries,
    runId,
  };
}

function createReplayEntry(runId: RunId, event: RuntimeEvent): RunAuditEntry {
  assertSameRun("runtime event", runId, event.runId);
  const approvalId = readApprovalId(event);

  return {
    correlation: {
      ...(approvalId ? { approvalId } : {}),
      runId,
      ...(event.stepId ? { stepId: event.stepId } : {}),
    },
    fact: {
      eventId: event.id,
      eventName: event.name,
      payload: event.payload,
      sequence: event.sequence,
      sourceOfTruth: "runtime-event",
    },
    kind: "replay-event",
    occurredAt: event.occurredAt,
    summary: summarizeReplayEvent(event),
  };
}

function createDispatchEntries(
  runId: RunId,
  job: DispatchJob,
): readonly RunAuditEntry[] {
  assertSameRun("dispatch job", runId, job.runId);
  const correlation = {
    dispatchJobId: job.id,
    runId,
    ...(job.claimedBy ? { workerId: job.claimedBy } : {}),
  } satisfies RunAuditEntryCorrelation;

  const entries: RunAuditEntry[] = [
    {
      correlation,
      fact: {
        attempts: job.attempts,
        dispatchJobId: job.id,
        dispatchKind: job.kind,
        dispatchStatus: job.status,
        sourceOfTruth: "dispatch",
        ...(job.claimedBy ? { workerId: job.claimedBy } : {}),
      },
      kind: "dispatch-enqueued",
      occurredAt: job.enqueuedAt,
      summary: `Dispatch job ${job.id} enqueued for ${job.kind}.`,
    },
  ];

  if (job.claimedAt) {
    entries.push({
      correlation,
      fact: {
        attempts: job.attempts,
        dispatchJobId: job.id,
        dispatchKind: job.kind,
        dispatchStatus: job.status,
        sourceOfTruth: "dispatch",
        ...(job.claimedBy ? { workerId: job.claimedBy } : {}),
      },
      kind: "dispatch-claimed",
      occurredAt: job.claimedAt,
      summary: `Dispatch job ${job.id} claimed by ${job.claimedBy ?? "unknown worker"}.`,
    });
  }

  if (job.completedAt && job.status === "completed") {
    entries.push({
      correlation,
      fact: {
        attempts: job.attempts,
        dispatchJobId: job.id,
        dispatchKind: job.kind,
        dispatchStatus: job.status,
        sourceOfTruth: "dispatch",
        ...(job.claimedBy ? { workerId: job.claimedBy } : {}),
      },
      kind: "dispatch-completed",
      occurredAt: job.completedAt,
      summary: `Dispatch job ${job.id} completed.`,
    });
  }

  if (job.completedAt && job.status === "failed") {
    entries.push({
      correlation,
      ...(job.failureMessage ? { detail: job.failureMessage } : {}),
      fact: {
        attempts: job.attempts,
        dispatchJobId: job.id,
        dispatchKind: job.kind,
        dispatchStatus: job.status,
        sourceOfTruth: "dispatch",
        ...(job.claimedBy ? { workerId: job.claimedBy } : {}),
      },
      kind: "dispatch-failed",
      occurredAt: job.completedAt,
      summary: `Dispatch job ${job.id} failed.`,
    });
  }

  return entries;
}

function createToolEntry(runId: RunId, entry: ToolHistoryEntry): RunAuditEntry {
  if (!entry.runId) {
    throw new Error(
      `Correlated audit projection requires tool history for run "${runId}" to include a runId.`,
    );
  }

  assertSameRun("tool history entry", runId, entry.runId);

  return {
    correlation: {
      ...(entry.dispatchJobId ? { dispatchJobId: entry.dispatchJobId } : {}),
      runId,
      ...(entry.stepId ? { stepId: entry.stepId } : {}),
      toolCallId: entry.callId,
      toolId: entry.toolId,
      ...(entry.workerId ? { workerId: entry.workerId } : {}),
    },
    ...(entry.outcomeDetail ? { detail: entry.outcomeDetail } : {}),
    fact: {
      ...(entry.attempt === undefined ? {} : { attempt: entry.attempt }),
      callId: entry.callId,
      ...(entry.executionMode ? { executionMode: entry.executionMode } : {}),
      inputSummary: entry.inputSummary,
      outcome: entry.outcome,
      ...(entry.outcomeDetail ? { outcomeDetail: entry.outcomeDetail } : {}),
      ...(entry.outputSummary ? { outputSummary: entry.outputSummary } : {}),
      source: entry.source,
      sourceOfTruth: "tool-history",
      toolName: entry.toolName,
      toolSource: entry.toolSource,
    },
    kind: "tool-outcome",
    occurredAt: entry.finishedAt,
    summary: `${entry.toolName} ${entry.outcome}.`,
  };
}

function summarizeReplayEvent(event: RuntimeEvent): string {
  switch (event.name) {
    case "approval.approved":
      return `Approval ${readApprovalId(event) ?? "unknown"} approved.`;
    case "approval.cancelled":
      return `Approval ${readApprovalId(event) ?? "unknown"} cancelled.`;
    case "approval.rejected":
      return `Approval ${readApprovalId(event) ?? "unknown"} rejected.`;
    case "approval.requested":
      return `Approval ${readApprovalId(event) ?? "unknown"} requested.`;
    case "checkpoint.saved":
      return `Checkpoint ${(event.payload as { checkpointId: string }).checkpointId} saved.`;
    case "run.cancelled":
      return "Run cancelled.";
    case "run.created":
      return "Run created.";
    case "run.failed":
      return "Run failed.";
    case "run.paused":
      return "Run paused.";
    case "run.queued":
      return "Run queued.";
    case "run.resumed":
      return "Run resumed.";
    case "run.started":
      return "Run started.";
    case "run.succeeded":
      return "Run succeeded.";
    case "step.cancelled":
      return `Step ${event.stepId ?? "unknown"} cancelled.`;
    case "step.completed":
      return `Step ${event.stepId ?? "unknown"} completed.`;
    case "step.failed":
      return `Step ${event.stepId ?? "unknown"} failed.`;
    case "step.paused":
      return `Step ${event.stepId ?? "unknown"} paused.`;
    case "step.ready":
      return `Step ${event.stepId ?? "unknown"} ready.`;
    case "step.retry_scheduled":
      return `Step ${event.stepId ?? "unknown"} retry scheduled.`;
    case "step.started":
      return `Step ${event.stepId ?? "unknown"} started.`;
  }
}

function readApprovalId(event: RuntimeEvent): string | undefined {
  const payload = event.payload as { approvalId?: string };

  return payload.approvalId;
}

function assertSameRun(
  entity: string,
  expectedRunId: RunId,
  actualRunId: RunId,
): void {
  if (actualRunId !== expectedRunId) {
    throw new Error(
      `Correlated audit projection received ${entity} for run "${actualRunId}" while projecting run "${expectedRunId}".`,
    );
  }
}

function compareAuditEntries(
  left: RunAuditEntry,
  right: RunAuditEntry,
): number {
  return (
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.kind.localeCompare(right.kind) ||
    readStableEntryId(left).localeCompare(readStableEntryId(right))
  );
}

function readStableEntryId(entry: RunAuditEntry): string {
  switch (entry.fact.sourceOfTruth) {
    case "runtime-event":
      return entry.fact.eventId;
    case "dispatch":
      return `${entry.fact.dispatchJobId}:${entry.kind}`;
    case "tool-history":
      return entry.fact.callId;
  }
}
