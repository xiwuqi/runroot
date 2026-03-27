export class ApprovalError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class ApprovalAlreadyDecidedError extends ApprovalError {
  constructor(approvalId: string, status: string) {
    super(
      `Approval "${approvalId}" is already in terminal status "${status}".`,
      "approval_already_decided",
    );
  }
}

export class ApprovalIdMismatchError extends ApprovalError {
  constructor(expectedApprovalId: string, receivedApprovalId: string) {
    super(
      `Approval id mismatch. Expected "${expectedApprovalId}", received "${receivedApprovalId}".`,
      "approval_id_mismatch",
    );
  }
}

export class ApprovalNotFoundError extends ApprovalError {
  constructor(approvalId: string) {
    super(`Approval "${approvalId}" was not found.`, "approval_not_found");
  }
}
