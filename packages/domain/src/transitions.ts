import { DomainInvariantError } from "./errors";
import type { FailureDetails } from "./failure";
import type { JsonValue } from "./json";
import { buildRunOutput, type RunStatus, type WorkflowRun } from "./run";
import type { CheckpointToken, StepStatus, WorkflowStep } from "./step";

const runTransitions: Record<RunStatus, readonly RunStatus[]> = {
  cancelled: [],
  failed: [],
  paused: ["queued", "cancelled"],
  pending: ["queued", "cancelled"],
  queued: ["running", "paused", "cancelled"],
  running: ["paused", "succeeded", "failed", "cancelled"],
  succeeded: [],
};

const stepTransitions: Record<StepStatus, readonly StepStatus[]> = {
  cancelled: [],
  completed: [],
  failed: [],
  idle: ["ready", "cancelled"],
  paused: ["ready", "cancelled"],
  ready: ["running", "cancelled"],
  retry_scheduled: ["ready", "failed", "cancelled"],
  running: ["completed", "failed", "paused", "retry_scheduled"],
};

export interface RunTransitionOptions {
  readonly failure?: FailureDetails;
  readonly pauseReason?: string;
}

export interface StepTransitionOptions {
  readonly checkpointToken?: CheckpointToken;
  readonly error?: FailureDetails;
  readonly output?: JsonValue;
}

export function advanceRunCursor(
  run: WorkflowRun,
  nextStepIndex: number,
  updatedAt: string,
): WorkflowRun {
  return {
    ...run,
    currentStepIndex: nextStepIndex,
    updatedAt,
  };
}

export function replaceRunStep(
  run: WorkflowRun,
  nextStep: WorkflowStep,
  updatedAt: string,
): WorkflowRun {
  return {
    ...run,
    steps: run.steps.map((step) => (step.id === nextStep.id ? nextStep : step)),
    updatedAt,
  };
}

export function transitionRunStatus(
  run: WorkflowRun,
  nextStatus: RunStatus,
  transitionedAt: string,
  options: RunTransitionOptions = {},
): WorkflowRun {
  assertTransition("run", run.status, nextStatus, runTransitions[run.status]);

  const baseRun: WorkflowRun = {
    ...run,
    status: nextStatus,
    updatedAt: transitionedAt,
    ...(nextStatus === "running" && !run.startedAt
      ? { startedAt: transitionedAt }
      : {}),
    ...(nextStatus === "paused" ? { pausedAt: transitionedAt } : {}),
    ...(nextStatus === "succeeded" || nextStatus === "failed"
      ? { completedAt: transitionedAt }
      : {}),
    ...(nextStatus === "failed" && options.failure
      ? { failure: options.failure }
      : {}),
    ...(nextStatus === "paused" && options.pauseReason
      ? { pauseReason: options.pauseReason }
      : {}),
  };

  if (nextStatus === "succeeded") {
    return {
      ...baseRun,
      output: buildRunOutput(baseRun.steps),
    };
  }

  return baseRun;
}

export function transitionStepStatus(
  step: WorkflowStep,
  nextStatus: StepStatus,
  transitionedAt: string,
  options: StepTransitionOptions = {},
): WorkflowStep {
  assertTransition(
    "step",
    step.status,
    nextStatus,
    stepTransitions[step.status],
  );

  return {
    ...step,
    attempts: nextStatus === "running" ? step.attempts + 1 : step.attempts,
    ...(nextStatus === "running" && !step.startedAt
      ? { startedAt: transitionedAt }
      : {}),
    ...(nextStatus === "completed" ? { completedAt: transitionedAt } : {}),
    ...(nextStatus === "paused" ? { pausedAt: transitionedAt } : {}),
    ...(options.output === undefined ? {} : { output: options.output }),
    ...(options.error ? { lastError: options.error } : {}),
    ...(options.checkpointToken
      ? { checkpointToken: options.checkpointToken }
      : {}),
    status: nextStatus,
    updatedAt: transitionedAt,
  };
}

function assertTransition(
  kind: "run" | "step",
  current: RunStatus | StepStatus,
  next: RunStatus | StepStatus,
  allowed: readonly (RunStatus | StepStatus)[],
): void {
  if (!allowed.includes(next)) {
    throw new DomainInvariantError(
      `Invalid ${kind} transition from "${current}" to "${next}".`,
    );
  }
}
