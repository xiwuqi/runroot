import { describe, expect, it } from "vitest";

import {
  createApprovalRequest,
  decideApproval,
  isApprovalPending,
} from "./approval";
import { ApprovalAlreadyDecidedError } from "./errors";

describe("@runroot/approvals domain", () => {
  it("creates a pending approval request", () => {
    const approval = createApprovalRequest({
      id: "approval_1",
      note: "Approve deployment",
      requestedAt: "2026-03-27T00:00:00.000Z",
      reviewer: {
        id: "ops",
      },
      runId: "run_1",
      stepId: "step_1",
    });

    expect(approval.status).toBe("pending");
    expect(isApprovalPending(approval)).toBe(true);
  });

  it("records an approval decision and updates the approval status", () => {
    const approval = createApprovalRequest({
      id: "approval_1",
      requestedAt: "2026-03-27T00:00:00.000Z",
      runId: "run_1",
      stepId: "step_1",
    });
    const result = decideApproval(approval, {
      actor: {
        id: "reviewer_1",
      },
      approvalId: "approval_1",
      decidedAt: "2026-03-27T00:01:00.000Z",
      decision: "approved",
      note: "Looks good",
    });

    expect(result.approval.status).toBe("approved");
    expect(result.decision.decision).toBe("approved");
    expect(result.approval.decidedBy?.id).toBe("reviewer_1");
  });

  it("rejects a second decision once the approval is terminal", () => {
    const approval = createApprovalRequest({
      id: "approval_1",
      requestedAt: "2026-03-27T00:00:00.000Z",
      runId: "run_1",
    });
    const decided = decideApproval(approval, {
      approvalId: "approval_1",
      decidedAt: "2026-03-27T00:01:00.000Z",
      decision: "rejected",
    });

    expect(() =>
      decideApproval(decided.approval, {
        approvalId: "approval_1",
        decidedAt: "2026-03-27T00:02:00.000Z",
        decision: "approved",
      }),
    ).toThrow(ApprovalAlreadyDecidedError);
  });
});
