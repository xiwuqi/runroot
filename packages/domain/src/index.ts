import type { PackageBoundary } from "@runroot/config";

export type {
  CheckpointId,
  CheckpointReason,
  WorkflowCheckpoint,
} from "./checkpoint";
export { DomainInvariantError } from "./errors";
export { type FailureDetails, serializeError } from "./failure";
export type {
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
} from "./json";
export {
  calculateRetryDelayMs,
  defaultRetryPolicy,
  type RetryPolicy,
  type RetryPolicyInput,
  type RetryStrategy,
  resolveRetryPolicy,
} from "./retry-policy";
export {
  buildRunOutput,
  type CreateWorkflowRunSnapshotInput,
  createWorkflowRunSnapshot,
  type RunId,
  type RunStatus,
  type WorkflowRun,
} from "./run";
export {
  type CheckpointToken,
  type CreateWorkflowStepSnapshotInput,
  createWorkflowStepSnapshot,
  type StepId,
  type StepStatus,
  type WorkflowStep,
} from "./step";
export {
  advanceRunCursor,
  type RunTransitionOptions,
  replaceRunStep,
  type StepTransitionOptions,
  transitionRunStatus,
  transitionStepStatus,
} from "./transitions";

export const domainPackageBoundary = {
  name: "@runroot/domain",
  kind: "package",
  phaseOwned: 2,
  responsibility:
    "Shared domain language for runs, steps, tool calls, approvals, and events.",
  publicSurface: ["domain models", "value objects", "domain errors"],
} as const satisfies PackageBoundary;
