import type {
  JsonValue,
  RetryPolicyInput,
  WorkflowCheckpoint,
  WorkflowRun,
  WorkflowStep,
} from "@runroot/domain";

export interface CompletedStepResult {
  readonly kind: "completed";
  readonly output?: JsonValue;
}

export interface PausedStepResult {
  readonly checkpointData?: JsonValue;
  readonly kind: "paused";
  readonly reason: string;
}

export type StepExecutionResult = CompletedStepResult | PausedStepResult;

export interface RuntimeStepContext {
  readonly attempt: number;
  readonly checkpoint?: WorkflowCheckpoint;
  readonly input: JsonValue;
  readonly run: WorkflowRun;
  readonly step: WorkflowStep;
}

export interface WorkflowStepDefinition {
  readonly execute:
    | ((
        context: RuntimeStepContext,
      ) => Promise<StepExecutionResult | undefined>)
    | ((context: RuntimeStepContext) => StepExecutionResult | undefined);
  readonly key: string;
  readonly name: string;
  readonly retryPolicy?: RetryPolicyInput;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly retryPolicy?: RetryPolicyInput;
  readonly steps: readonly WorkflowStepDefinition[];
  readonly version: string;
}

export function completeStep(output?: JsonValue): CompletedStepResult {
  return {
    kind: "completed",
    ...(output === undefined ? {} : { output }),
  };
}

export function pauseStep(
  reason: string,
  checkpointData?: JsonValue,
): PausedStepResult {
  return {
    ...(checkpointData === undefined ? {} : { checkpointData }),
    kind: "paused",
    reason,
  };
}
