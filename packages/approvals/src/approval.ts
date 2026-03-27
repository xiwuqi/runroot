import type { RunId, StepId } from "@runroot/domain";

import { ApprovalAlreadyDecidedError, ApprovalIdMismatchError } from "./errors";

export type ApprovalId = string;
export type ApprovalDecisionValue = "approved" | "cancelled" | "rejected";
export type ApprovalStatus = "approved" | "cancelled" | "pending" | "rejected";

export interface ApprovalActor {
  readonly displayName?: string;
  readonly id: string;
}

export interface ApprovalRequest {
  readonly decidedAt?: string;
  readonly decidedBy?: ApprovalActor;
  readonly decision?: ApprovalDecisionValue;
  readonly decisionNote?: string;
  readonly id: ApprovalId;
  readonly note?: string;
  readonly requestedAt: string;
  readonly requestedBy?: ApprovalActor;
  readonly reviewer?: ApprovalActor;
  readonly runId: RunId;
  readonly status: ApprovalStatus;
  readonly stepId?: StepId;
}

export interface ApprovalRequestInput {
  readonly id: ApprovalId;
  readonly note?: string;
  readonly requestedAt: string;
  readonly requestedBy?: ApprovalActor;
  readonly reviewer?: ApprovalActor;
  readonly runId: RunId;
  readonly stepId?: StepId;
}

export interface ApprovalDecisionInput {
  readonly actor?: ApprovalActor;
  readonly approvalId: ApprovalId;
  readonly decidedAt: string;
  readonly decision: ApprovalDecisionValue;
  readonly note?: string;
}

export interface ApprovalDecision {
  readonly actor?: ApprovalActor;
  readonly approvalId: ApprovalId;
  readonly decidedAt: string;
  readonly decision: ApprovalDecisionValue;
  readonly note?: string;
  readonly runId: RunId;
  readonly stepId?: StepId;
}

export interface ApprovalDecisionResult {
  readonly approval: ApprovalRequest;
  readonly decision: ApprovalDecision;
}

export function createApprovalRequest(
  input: ApprovalRequestInput,
): ApprovalRequest {
  return {
    id: input.id,
    requestedAt: input.requestedAt,
    runId: input.runId,
    status: "pending",
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(input.requestedBy === undefined
      ? {}
      : { requestedBy: input.requestedBy }),
    ...(input.reviewer === undefined ? {} : { reviewer: input.reviewer }),
    ...(input.stepId === undefined ? {} : { stepId: input.stepId }),
  };
}

export function decideApproval(
  request: ApprovalRequest,
  input: ApprovalDecisionInput,
): ApprovalDecisionResult {
  if (request.id !== input.approvalId) {
    throw new ApprovalIdMismatchError(request.id, input.approvalId);
  }

  if (request.status !== "pending") {
    throw new ApprovalAlreadyDecidedError(request.id, request.status);
  }

  const decision: ApprovalDecision = {
    approvalId: request.id,
    decidedAt: input.decidedAt,
    decision: input.decision,
    runId: request.runId,
    ...(input.actor === undefined ? {} : { actor: input.actor }),
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(request.stepId === undefined ? {} : { stepId: request.stepId }),
  };

  const approval: ApprovalRequest = {
    ...request,
    decidedAt: input.decidedAt,
    status: input.decision,
    ...(input.actor === undefined ? {} : { decidedBy: input.actor }),
    ...(input.note === undefined ? {} : { decisionNote: input.note }),
    decision: input.decision,
  };

  return {
    approval,
    decision,
  };
}

export function isApprovalPending(request: ApprovalRequest): boolean {
  return request.status === "pending";
}
