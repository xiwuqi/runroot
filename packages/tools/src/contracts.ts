import type { JsonValue } from "@runroot/domain";

import type { ToolSchema } from "./schema";

export interface ToolMetadata {
  readonly capabilities?: readonly string[];
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly tags?: readonly string[];
}

export interface ToolOutputContract {
  readonly description: string;
  readonly schema: ToolSchema;
}

export interface ToolReferenceById {
  readonly kind: "id";
  readonly value: string;
}

export interface ToolReferenceByName {
  readonly kind: "name";
  readonly value: string;
}

export type ToolReference = ToolReferenceById | ToolReferenceByName;

export interface ToolInvocationRequest {
  readonly input: JsonValue;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly tool: ToolReference;
}

export interface ToolInvocationContext {
  readonly actorId?: string;
  readonly attempt?: number;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly runId?: string;
  readonly source: string;
  readonly stepId?: string;
}

export interface ToolInvocationResult {
  readonly callId: string;
  readonly finishedAt: string;
  readonly output: JsonValue;
  readonly startedAt: string;
  readonly toolId: string;
  readonly toolName: string;
}

export interface ToolExecutionContext<TInput = JsonValue> {
  readonly context: ToolInvocationContext;
  readonly input: TInput;
  readonly request: ToolInvocationRequest;
}

export interface ToolDefinition<TInput = JsonValue, TOutput = JsonValue> {
  readonly inputSchema: ToolSchema;
  readonly invoke:
    | ((context: ToolExecutionContext<TInput>) => Promise<TOutput>)
    | ((context: ToolExecutionContext<TInput>) => TOutput);
  readonly metadata: ToolMetadata;
  readonly output: ToolOutputContract;
}

export interface ToolPermissionDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface ToolPermissionRequest {
  readonly context: ToolInvocationContext;
  readonly request: ToolInvocationRequest;
  readonly tool: ToolDefinition;
}

export interface ToolPermissionGate {
  evaluate(
    request: ToolPermissionRequest,
  ): Promise<ToolPermissionDecision> | ToolPermissionDecision;
}

export interface ToolInvocationStartedEvent {
  readonly callId: string;
  readonly context: ToolInvocationContext;
  readonly occurredAt: string;
  readonly request: ToolInvocationRequest;
  readonly startedAt: string;
  readonly tool: ToolMetadata;
}

export interface ToolInvocationBlockedEvent extends ToolInvocationStartedEvent {
  readonly decision: ToolPermissionDecision;
}

export interface ToolInvocationFailedEvent extends ToolInvocationStartedEvent {
  readonly error: Error;
}

export interface ToolInvocationSucceededEvent
  extends ToolInvocationStartedEvent {
  readonly result: ToolInvocationResult;
}

export interface ToolInvocationObserver {
  onInvocationBlocked?:
    | ((event: ToolInvocationBlockedEvent) => Promise<void>)
    | ((event: ToolInvocationBlockedEvent) => void);
  onInvocationFailed?:
    | ((event: ToolInvocationFailedEvent) => Promise<void>)
    | ((event: ToolInvocationFailedEvent) => void);
  onInvocationStarted?:
    | ((event: ToolInvocationStartedEvent) => Promise<void>)
    | ((event: ToolInvocationStartedEvent) => void);
  onInvocationSucceeded?:
    | ((event: ToolInvocationSucceededEvent) => Promise<void>)
    | ((event: ToolInvocationSucceededEvent) => void);
}

export interface ToolInvoker {
  invoke(
    request: ToolInvocationRequest,
    context: ToolInvocationContext,
  ): Promise<ToolInvocationResult>;
}
