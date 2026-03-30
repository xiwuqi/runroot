export class OperatorError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.code = code;
    this.name = "OperatorError";
    this.statusCode = statusCode;
  }
}

export class OperatorConflictError extends OperatorError {
  constructor(message: string) {
    super(message, "operator_conflict", 409);
    this.name = "OperatorConflictError";
  }
}

export class OperatorInputError extends OperatorError {
  constructor(message: string) {
    super(message, "operator_input_invalid", 400);
    this.name = "OperatorInputError";
  }
}

export class OperatorNotFoundError extends OperatorError {
  constructor(
    resource:
      | "approval"
      | "catalog entry"
      | "catalog visibility"
      | "run"
      | "saved view"
      | "template",
    identifier: string,
  ) {
    super(
      `${resource[0]?.toUpperCase() ?? resource}${resource.slice(1)} "${identifier}" was not found.`,
      "operator_not_found",
      404,
    );
    this.name = "OperatorNotFoundError";
  }
}
