import { randomUUID } from "node:crypto";

import type { JsonValue } from "@runroot/domain";

import type {
  ToolDefinition,
  ToolInvocationBlockedEvent,
  ToolInvocationContext,
  ToolInvocationFailedEvent,
  ToolInvocationObserver,
  ToolInvocationRequest,
  ToolInvocationResult,
  ToolInvocationStartedEvent,
  ToolInvocationSucceededEvent,
  ToolInvoker,
  ToolPermissionGate,
} from "./contracts";
import {
  ToolInvocationError,
  ToolPermissionError,
  ToolValidationError,
} from "./errors";
import { allowAllToolPermissionGate } from "./permission";
import type { ToolRegistry } from "./registry";
import { validateToolValue } from "./schema";

export interface RegistryToolInvokerOptions {
  readonly callIdGenerator?: () => string;
  readonly now?: () => string;
  readonly observer?:
    | ToolInvocationObserver
    | readonly ToolInvocationObserver[];
  readonly permissionGate?: ToolPermissionGate;
  readonly registry: ToolRegistry;
}

export function createRegistryToolInvoker(
  options: RegistryToolInvokerOptions,
): ToolInvoker {
  return new RegistryToolInvoker(options);
}

export function createUnavailableToolInvoker(
  message = "Tool invocation is not configured for this runtime engine.",
): ToolInvoker {
  return {
    async invoke(request) {
      throw new ToolInvocationError(message, {
        code: "tool_invoker_unavailable",
        ...(request.tool.kind === "id" ? { toolId: request.tool.value } : {}),
        ...(request.tool.kind === "name"
          ? { toolName: request.tool.value }
          : {}),
      });
    },
  };
}

class RegistryToolInvoker implements ToolInvoker {
  readonly #callIdGenerator: () => string;
  readonly #now: () => string;
  readonly #observers: readonly ToolInvocationObserver[];
  readonly #permissionGate: ToolPermissionGate;
  readonly #registry: ToolRegistry;

  constructor(options: RegistryToolInvokerOptions) {
    this.#callIdGenerator = options.callIdGenerator ?? (() => randomUUID());
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#observers = normalizeObservers(options.observer);
    this.#permissionGate = options.permissionGate ?? allowAllToolPermissionGate;
    this.#registry = options.registry;
  }

  async invoke(
    request: ToolInvocationRequest,
    context: ToolInvocationContext,
  ): Promise<ToolInvocationResult> {
    const callId = this.#callIdGenerator();
    const tool = this.#registry.require(request.tool);
    const startedAt = this.#now();
    const lifecycleBase = createLifecycleBase(
      callId,
      context,
      request,
      startedAt,
      tool,
    );

    this.#assertValidValue(request.input, tool, "input");

    const permissionDecision = await this.#permissionGate.evaluate({
      context,
      request,
      tool,
    });

    if (!permissionDecision.allowed) {
      const error = new ToolPermissionError(
        tool.metadata.id,
        tool.metadata.name,
        permissionDecision.reason ?? "permission gate denied the request",
      );

      await this.#notifyBlocked({
        ...lifecycleBase,
        occurredAt: this.#now(),
        decision: permissionDecision,
      });

      throw error;
    }

    await this.#notifyStarted(lifecycleBase);

    try {
      const rawOutput = await tool.invoke({
        context,
        input: request.input,
        request,
      });

      this.#assertValidValue(rawOutput as JsonValue, tool, "output");

      const finishedAt = this.#now();
      const result: ToolInvocationResult = {
        callId,
        finishedAt,
        output: rawOutput as JsonValue,
        startedAt,
        toolId: tool.metadata.id,
        toolName: tool.metadata.name,
      };

      await this.#notifySucceeded({
        ...lifecycleBase,
        occurredAt: finishedAt,
        result,
      });

      return result;
    } catch (error) {
      const normalizedError = normalizeToolInvocationError(error, tool);

      await this.#notifyFailed({
        ...lifecycleBase,
        occurredAt: this.#now(),
        error: normalizedError,
      });

      throw normalizedError;
    }
  }

  #assertValidValue(
    value: JsonValue,
    tool: ToolDefinition,
    stage: "input" | "output",
  ): void {
    const schema = stage === "input" ? tool.inputSchema : tool.output.schema;
    const issues = validateToolValue(value, schema, stage);

    if (issues.length > 0) {
      throw new ToolValidationError(stage, issues);
    }
  }

  async #notifyBlocked(event: ToolInvocationBlockedEvent): Promise<void> {
    for (const observer of this.#observers) {
      await observer.onInvocationBlocked?.(event);
    }
  }

  async #notifyFailed(event: ToolInvocationFailedEvent): Promise<void> {
    for (const observer of this.#observers) {
      await observer.onInvocationFailed?.(event);
    }
  }

  async #notifyStarted(event: ToolInvocationStartedEvent): Promise<void> {
    for (const observer of this.#observers) {
      await observer.onInvocationStarted?.(event);
    }
  }

  async #notifySucceeded(event: ToolInvocationSucceededEvent): Promise<void> {
    for (const observer of this.#observers) {
      await observer.onInvocationSucceeded?.(event);
    }
  }
}

function createLifecycleBase(
  callId: string,
  context: ToolInvocationContext,
  request: ToolInvocationRequest,
  startedAt: string,
  tool: ToolDefinition,
): ToolInvocationStartedEvent {
  return {
    callId,
    context,
    occurredAt: startedAt,
    request,
    startedAt,
    tool: tool.metadata,
  };
}

function normalizeObservers(
  observer?: ToolInvocationObserver | readonly ToolInvocationObserver[],
): readonly ToolInvocationObserver[] {
  if (!observer) {
    return [];
  }

  if (isObserverList(observer)) {
    return [...observer];
  }

  return [observer];
}

function isObserverList(
  observer: ToolInvocationObserver | readonly ToolInvocationObserver[],
): observer is readonly ToolInvocationObserver[] {
  return Array.isArray(observer);
}

function normalizeToolInvocationError(
  error: unknown,
  tool: ToolDefinition,
): Error {
  if (error instanceof ToolInvocationError) {
    return error;
  }

  if (error instanceof ToolValidationError) {
    return error;
  }

  return new ToolInvocationError(
    `Tool "${tool.metadata.name}" failed during invocation.`,
    {
      cause: error,
      toolId: tool.metadata.id,
      toolName: tool.metadata.name,
    },
  );
}
