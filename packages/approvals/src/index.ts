import type { PackageBoundary } from "@runroot/config";

export type {
  ApprovalActor,
  ApprovalDecision,
  ApprovalDecisionInput,
  ApprovalDecisionResult,
  ApprovalDecisionValue,
  ApprovalId,
  ApprovalRequest,
  ApprovalRequestInput,
  ApprovalStatus,
} from "./approval";
export {
  createApprovalRequest,
  decideApproval,
  isApprovalPending,
} from "./approval";
export {
  ApprovalAlreadyDecidedError,
  ApprovalError,
  ApprovalIdMismatchError,
  ApprovalNotFoundError,
} from "./errors";

export const approvalsPackageBoundary = {
  name: "@runroot/approvals",
  kind: "package",
  phaseOwned: 4,
  responsibility: "Approval requests, decisions, and resumable operator gates.",
  publicSurface: ["approval models", "decision handling", "resume contracts"],
} as const satisfies PackageBoundary;
