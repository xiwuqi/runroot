import type { ApprovalActor } from "@runroot/approvals";
import type {
  JsonValue,
  RetryPolicyInput,
  WorkflowCheckpoint,
  WorkflowRun,
  WorkflowStep,
} from "@runroot/domain";
import type { ToolInvoker } from "@runroot/tools";

export interface CompletedStepResult {
  readonly kind: "completed";
  readonly output?: JsonValue;
}

export interface PausedStepResult {
  readonly checkpointData?: JsonValue;
  readonly kind: "paused";
  readonly reason: string;
}

export interface AwaitApprovalInput {
  readonly checkpointData?: JsonValue;
  readonly note?: string;
  readonly requestedBy?: ApprovalActor;
  readonly reviewer?: ApprovalActor;
}

export interface AwaitingApprovalStepResult extends AwaitApprovalInput {
  readonly kind: "awaiting_approval";
}

export type StepExecutionResult =
  | AwaitingApprovalStepResult
  | CompletedStepResult
  | PausedStepResult;

export interface RuntimeStepContext {
  readonly attempt: number;
  readonly checkpoint?: WorkflowCheckpoint;
  readonly input: JsonValue;
  readonly run: WorkflowRun;
  readonly step: WorkflowStep;
  readonly tools: ToolInvoker;
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

export function awaitApproval(
  input: AwaitApprovalInput = {},
): AwaitingApprovalStepResult {
  return {
    ...(input.checkpointData === undefined
      ? {}
      : { checkpointData: input.checkpointData }),
    kind: "awaiting_approval",
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(input.requestedBy === undefined
      ? {}
      : { requestedBy: input.requestedBy }),
    ...(input.reviewer === undefined ? {} : { reviewer: input.reviewer }),
  };
}
