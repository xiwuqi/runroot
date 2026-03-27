export class ToolError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class DuplicateToolRegistrationError extends ToolError {
  constructor(toolId: string, toolName: string) {
    super(
      `Tool "${toolName}" with id "${toolId}" is already registered.`,
      "tool_duplicate_registration",
    );
  }
}

export class InvalidToolDefinitionError extends ToolError {
  constructor(message: string) {
    super(message, "tool_definition_invalid");
  }
}

export class ToolNotFoundError extends ToolError {
  constructor(reference: string) {
    super(`Tool "${reference}" was not found.`, "tool_not_found");
  }
}

export class ToolValidationError extends ToolError {
  readonly issues: readonly string[];
  readonly stage: "input" | "output";

  constructor(stage: "input" | "output", issues: readonly string[]) {
    super(
      `Tool ${stage} validation failed: ${issues.join(" ")}`,
      `tool_${stage}_invalid`,
    );
    this.issues = [...issues];
    this.stage = stage;
  }
}

export interface ToolInvocationErrorOptions {
  readonly cause?: unknown;
  readonly code?: string;
  readonly toolId?: string;
  readonly toolName?: string;
}

export class ToolInvocationError extends ToolError {
  override readonly cause?: unknown;
  readonly toolId?: string;
  readonly toolName?: string;

  constructor(message: string, options: ToolInvocationErrorOptions = {}) {
    super(message, options.code ?? "tool_invocation_failed");

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }

    if (options.toolId !== undefined) {
      this.toolId = options.toolId;
    }

    if (options.toolName !== undefined) {
      this.toolName = options.toolName;
    }
  }
}

export class ToolPermissionError extends ToolInvocationError {
  constructor(toolId: string, toolName: string, reason: string) {
    super(`Tool "${toolName}" is not allowed to run: ${reason}`, {
      code: "tool_permission_denied",
      toolId,
      toolName,
    });
  }
}
