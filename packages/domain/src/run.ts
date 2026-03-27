import type { FailureDetails } from "./failure";
import type { JsonObject, JsonValue } from "./json";
import type { RetryPolicy } from "./retry-policy";
import type { WorkflowStep } from "./step";

export type RunId = string;

export type RunStatus =
  | "cancelled"
  | "failed"
  | "paused"
  | "pending"
  | "queued"
  | "running"
  | "succeeded";

export interface WorkflowRun {
  readonly completedAt?: string;
  readonly createdAt: string;
  readonly currentStepIndex: number;
  readonly definitionId: string;
  readonly definitionName: string;
  readonly definitionVersion: string;
  readonly failure?: FailureDetails;
  readonly id: RunId;
  readonly input: JsonValue;
  readonly metadata: Readonly<Record<string, string>>;
  readonly output?: JsonObject;
  readonly pauseReason?: string;
  readonly pausedAt?: string;
  readonly retryPolicy: RetryPolicy;
  readonly startedAt?: string;
  readonly status: RunStatus;
  readonly steps: readonly WorkflowStep[];
  readonly updatedAt: string;
}

export interface CreateWorkflowRunSnapshotInput {
  readonly createdAt: string;
  readonly currentStepIndex?: number;
  readonly definitionId: string;
  readonly definitionName: string;
  readonly definitionVersion: string;
  readonly id: RunId;
  readonly input: JsonValue;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly retryPolicy: RetryPolicy;
  readonly steps: readonly WorkflowStep[];
}

export function buildRunOutput(steps: readonly WorkflowStep[]): JsonObject {
  const output: JsonObject = {};

  for (const step of steps) {
    if (step.output !== undefined) {
      output[step.key] = step.output;
    }
  }

  return output;
}

export function createWorkflowRunSnapshot(
  input: CreateWorkflowRunSnapshotInput,
): WorkflowRun {
  return {
    createdAt: input.createdAt,
    currentStepIndex: input.currentStepIndex ?? 0,
    definitionId: input.definitionId,
    definitionName: input.definitionName,
    definitionVersion: input.definitionVersion,
    id: input.id,
    input: input.input,
    metadata: input.metadata ?? {},
    retryPolicy: input.retryPolicy,
    status: "pending",
    steps: input.steps,
    updatedAt: input.createdAt,
  };
}
