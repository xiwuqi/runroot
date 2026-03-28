import type { JsonValue, RunId, StepId } from "@runroot/domain";
import type {
  ToolInvocationBlockedEvent,
  ToolInvocationFailedEvent,
  ToolInvocationSucceededEvent,
} from "./contracts";

export type ToolExecutionMode = "inline" | "queued";

export type ToolHistoryOutcome = "blocked" | "failed" | "succeeded";

export const toolTelemetryMetadataKeys = {
  dispatchJobId: "dispatchJobId",
  executionMode: "executionMode",
  workerId: "workerId",
} as const;

export interface ToolHistoryEntry {
  readonly attempt?: number;
  readonly callId: string;
  readonly dispatchJobId?: string;
  readonly executionMode?: ToolExecutionMode;
  readonly finishedAt: string;
  readonly inputSummary: string;
  readonly outcome: ToolHistoryOutcome;
  readonly outcomeDetail?: string;
  readonly outputSummary?: string;
  readonly runId?: RunId;
  readonly source: string;
  readonly startedAt: string;
  readonly stepId?: StepId;
  readonly toolId: string;
  readonly toolName: string;
  readonly toolSource: string;
  readonly workerId?: string;
}

export interface ToolHistoryStore {
  listByRunId(runId: RunId): Promise<readonly ToolHistoryEntry[]>;
  save(entry: ToolHistoryEntry): Promise<ToolHistoryEntry>;
}

export function createBlockedToolHistoryEntry(
  event: ToolInvocationBlockedEvent,
): ToolHistoryEntry {
  return {
    ...readCorrelation(event.context),
    callId: event.callId,
    finishedAt: event.occurredAt,
    inputSummary: summarizeToolValue(event.request.input),
    outcome: "blocked",
    ...(event.decision.reason ? { outcomeDetail: event.decision.reason } : {}),
    startedAt: event.startedAt,
    toolId: event.tool.id,
    toolName: event.tool.name,
    toolSource: event.tool.source,
  };
}

export function createFailedToolHistoryEntry(
  event: ToolInvocationFailedEvent,
): ToolHistoryEntry {
  return {
    ...readCorrelation(event.context),
    callId: event.callId,
    finishedAt: event.occurredAt,
    inputSummary: summarizeToolValue(event.request.input),
    outcome: "failed",
    ...(event.error.message ? { outcomeDetail: event.error.message } : {}),
    startedAt: event.startedAt,
    toolId: event.tool.id,
    toolName: event.tool.name,
    toolSource: event.tool.source,
  };
}

export function createSucceededToolHistoryEntry(
  event: ToolInvocationSucceededEvent,
): ToolHistoryEntry {
  return {
    ...readCorrelation(event.context),
    callId: event.callId,
    finishedAt: event.result.finishedAt,
    inputSummary: summarizeToolValue(event.request.input),
    outcome: "succeeded",
    outputSummary: summarizeToolValue(event.result.output),
    startedAt: event.result.startedAt,
    toolId: event.tool.id,
    toolName: event.tool.name,
    toolSource: event.tool.source,
  };
}

export function summarizeToolValue(value: JsonValue): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean") {
    return `boolean(${value})`;
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "string") {
    return `string(length=${value.length})`;
  }

  if (Array.isArray(value)) {
    return `array(length=${value.length})`;
  }

  const keys = Object.keys(value).sort();

  return keys.length > 0 ? `object(keys=${keys.join(",")})` : "object(empty)";
}

function readCorrelation(context: {
  readonly attempt?: number;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly runId?: RunId;
  readonly source: string;
  readonly stepId?: StepId;
}) {
  const metadata = context.metadata ?? {};
  const executionMode = readExecutionMode(
    metadata[toolTelemetryMetadataKeys.executionMode],
  );

  return {
    ...(context.attempt === undefined ? {} : { attempt: context.attempt }),
    ...(metadata[toolTelemetryMetadataKeys.dispatchJobId]
      ? { dispatchJobId: metadata[toolTelemetryMetadataKeys.dispatchJobId] }
      : {}),
    ...(executionMode ? { executionMode } : {}),
    ...(context.runId ? { runId: context.runId } : {}),
    source: context.source,
    ...(context.stepId ? { stepId: context.stepId } : {}),
    ...(metadata[toolTelemetryMetadataKeys.workerId]
      ? { workerId: metadata[toolTelemetryMetadataKeys.workerId] }
      : {}),
  };
}

function readExecutionMode(
  value: string | undefined,
): ToolExecutionMode | undefined {
  if (value === "inline" || value === "queued") {
    return value;
  }

  return undefined;
}
