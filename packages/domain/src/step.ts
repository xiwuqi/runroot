import type { FailureDetails } from "./failure";
import type { JsonValue } from "./json";
import type { RetryPolicy } from "./retry-policy";
import type { RunId } from "./run";

export type CheckpointToken = string;
export type StepId = string;

export type StepStatus =
  | "cancelled"
  | "completed"
  | "failed"
  | "idle"
  | "paused"
  | "ready"
  | "retry_scheduled"
  | "running";

export interface WorkflowStep {
  readonly attempts: number;
  readonly checkpointToken?: CheckpointToken;
  readonly completedAt?: string;
  readonly id: StepId;
  readonly index: number;
  readonly key: string;
  readonly lastError?: FailureDetails;
  readonly maxAttempts: number;
  readonly name: string;
  readonly output?: JsonValue;
  readonly pausedAt?: string;
  readonly retryPolicy: RetryPolicy;
  readonly runId: RunId;
  readonly startedAt?: string;
  readonly status: StepStatus;
  readonly updatedAt: string;
}

export interface CreateWorkflowStepSnapshotInput {
  readonly createdAt: string;
  readonly id: StepId;
  readonly index: number;
  readonly key: string;
  readonly name: string;
  readonly retryPolicy: RetryPolicy;
  readonly runId: RunId;
}

export function createWorkflowStepSnapshot(
  input: CreateWorkflowStepSnapshotInput,
): WorkflowStep {
  return {
    attempts: 0,
    id: input.id,
    index: input.index,
    key: input.key,
    maxAttempts: input.retryPolicy.maxAttempts,
    name: input.name,
    retryPolicy: input.retryPolicy,
    runId: input.runId,
    status: input.index === 0 ? "ready" : "idle",
    updatedAt: input.createdAt,
  };
}
