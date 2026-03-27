import type { JsonValue } from "./json";
import type { RunId } from "./run";
import type { StepId } from "./step";

export type CheckpointId = string;

export type CheckpointReason =
  | "run_created"
  | "run_failed"
  | "run_paused"
  | "run_succeeded"
  | "step_completed"
  | "step_paused"
  | "step_retry_scheduled";

export interface WorkflowCheckpoint {
  readonly attempt: number;
  readonly createdAt: string;
  readonly id: CheckpointId;
  readonly nextStepIndex: number;
  readonly payload?: JsonValue;
  readonly reason: CheckpointReason;
  readonly runId: RunId;
  readonly sequence: number;
  readonly stepId?: StepId;
}
