import type { ApprovalDecisionValue, ApprovalStatus } from "@runroot/approvals";
import type {
  CheckpointReason,
  FailureDetails,
  JsonValue,
  RunId,
  RunStatus,
  StepId,
  StepStatus,
} from "@runroot/domain";

export type RuntimeEventName =
  | "approval.approved"
  | "approval.cancelled"
  | "approval.rejected"
  | "approval.requested"
  | "checkpoint.saved"
  | "run.created"
  | "run.cancelled"
  | "run.failed"
  | "run.paused"
  | "run.queued"
  | "run.resumed"
  | "run.started"
  | "run.succeeded"
  | "step.cancelled"
  | "step.completed"
  | "step.failed"
  | "step.paused"
  | "step.ready"
  | "step.retry_scheduled"
  | "step.started";

export interface RuntimeEventPayloadMap {
  "approval.approved": {
    readonly actorId?: string;
    readonly approvalId: string;
    readonly decision: ApprovalDecisionValue;
    readonly status: ApprovalStatus;
  };
  "approval.cancelled": {
    readonly actorId?: string;
    readonly approvalId: string;
    readonly decision: ApprovalDecisionValue;
    readonly status: ApprovalStatus;
  };
  "approval.rejected": {
    readonly actorId?: string;
    readonly approvalId: string;
    readonly decision: ApprovalDecisionValue;
    readonly status: ApprovalStatus;
  };
  "approval.requested": {
    readonly approvalId: string;
    readonly reviewerId?: string;
    readonly status: ApprovalStatus;
  };
  "checkpoint.saved": {
    readonly attempt: number;
    readonly checkpointId: string;
    readonly nextStepIndex: number;
    readonly reason: CheckpointReason;
  };
  "run.created": {
    readonly definitionId: string;
    readonly status: RunStatus;
  };
  "run.cancelled": {
    readonly approvalId?: string;
    readonly reason: string;
    readonly status: RunStatus;
  };
  "run.failed": {
    readonly error: FailureDetails;
    readonly status: RunStatus;
  };
  "run.paused": {
    readonly reason: string;
    readonly status: RunStatus;
  };
  "run.queued": {
    readonly fromStatus: RunStatus;
    readonly toStatus: RunStatus;
  };
  "run.resumed": {
    readonly checkpointId?: string;
    readonly fromStatus: RunStatus;
    readonly toStatus: RunStatus;
  };
  "run.started": {
    readonly fromStatus: RunStatus;
    readonly toStatus: RunStatus;
  };
  "run.succeeded": {
    readonly completedStepCount: number;
    readonly status: RunStatus;
  };
  "step.cancelled": {
    readonly attempt: number;
    readonly reason: string;
    readonly status: StepStatus;
  };
  "step.completed": {
    readonly attempt: number;
    readonly status: StepStatus;
  };
  "step.failed": {
    readonly attempt: number;
    readonly error: FailureDetails;
    readonly status: StepStatus;
  };
  "step.paused": {
    readonly attempt: number;
    readonly reason: string;
    readonly status: StepStatus;
  };
  "step.ready": {
    readonly attempt: number;
    readonly status: StepStatus;
  };
  "step.retry_scheduled": {
    readonly attempt: number;
    readonly delayMs: number;
    readonly nextAttempt: number;
    readonly status: StepStatus;
  };
  "step.started": {
    readonly attempt: number;
    readonly status: StepStatus;
  };
}

export interface RuntimeEvent<
  TName extends RuntimeEventName = RuntimeEventName,
> {
  readonly id: string;
  readonly name: TName;
  readonly occurredAt: string;
  readonly payload: RuntimeEventPayloadMap[TName];
  readonly runId: RunId;
  readonly sequence: number;
  readonly stepId?: StepId;
}

export interface RuntimeEventInput<
  TName extends RuntimeEventName = RuntimeEventName,
> {
  readonly name: TName;
  readonly occurredAt: string;
  readonly payload: RuntimeEventPayloadMap[TName];
  readonly runId: RunId;
  readonly stepId?: StepId;
}

export interface CheckpointPayload {
  readonly data?: JsonValue;
}
