import type { RunId, StepId } from "@runroot/domain";
import type { RuntimeEvent, RuntimeEventName } from "@runroot/events";

export type RunTimelineEntryKind =
  | "approval-approved"
  | "approval-cancelled"
  | "approval-rejected"
  | "checkpoint-saved"
  | "run-cancelled"
  | "run-created"
  | "run-failed"
  | "run-paused"
  | "run-queued"
  | "run-resumed"
  | "run-started"
  | "run-succeeded"
  | "step-cancelled"
  | "step-completed"
  | "step-failed"
  | "step-paused"
  | "step-ready"
  | "step-retry-scheduled"
  | "step-started"
  | "waiting-for-approval";

export interface RunTimelineEntry {
  readonly eventId: string;
  readonly eventName: RuntimeEventName;
  readonly kind: RunTimelineEntryKind;
  readonly occurredAt: string;
  readonly payload: RuntimeEvent["payload"];
  readonly runId: RunId;
  readonly sequence: number;
  readonly stepId?: StepId;
}

export interface RunTimeline {
  readonly entries: readonly RunTimelineEntry[];
  readonly runId: RunId;
}

export function projectRunTimeline(
  runId: RunId,
  events: readonly RuntimeEvent[],
): RunTimeline {
  const sortedEvents = [...events].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const entries = sortedEvents.map((event) => {
    if (event.runId !== runId) {
      throw new Error(
        `Replay timeline projection received event for run "${event.runId}" while projecting run "${runId}".`,
      );
    }

    return createRunTimelineEntry(event);
  });

  return {
    entries,
    runId,
  };
}

function createRunTimelineEntry(event: RuntimeEvent): RunTimelineEntry {
  return {
    eventId: event.id,
    eventName: event.name,
    kind: eventNameToTimelineKind(event.name),
    occurredAt: event.occurredAt,
    payload: event.payload,
    runId: event.runId,
    sequence: event.sequence,
    ...(event.stepId ? { stepId: event.stepId } : {}),
  };
}

function eventNameToTimelineKind(name: RuntimeEventName): RunTimelineEntryKind {
  switch (name) {
    case "approval.approved":
      return "approval-approved";
    case "approval.cancelled":
      return "approval-cancelled";
    case "approval.rejected":
      return "approval-rejected";
    case "approval.requested":
      return "waiting-for-approval";
    case "checkpoint.saved":
      return "checkpoint-saved";
    case "run.cancelled":
      return "run-cancelled";
    case "run.created":
      return "run-created";
    case "run.failed":
      return "run-failed";
    case "run.paused":
      return "run-paused";
    case "run.queued":
      return "run-queued";
    case "run.resumed":
      return "run-resumed";
    case "run.started":
      return "run-started";
    case "run.succeeded":
      return "run-succeeded";
    case "step.cancelled":
      return "step-cancelled";
    case "step.completed":
      return "step-completed";
    case "step.failed":
      return "step-failed";
    case "step.paused":
      return "step-paused";
    case "step.ready":
      return "step-ready";
    case "step.retry_scheduled":
      return "step-retry-scheduled";
    case "step.started":
      return "step-started";
  }
}
