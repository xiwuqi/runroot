import {
  createNoopLogger,
  createNoopTracer,
  type ObservationAttributes,
  type RunrootLogger,
  type RunrootTracer,
  type TraceSpan,
} from "@runroot/observability";
import {
  createBlockedToolHistoryEntry,
  createFailedToolHistoryEntry,
  createSucceededToolHistoryEntry,
  type ToolHistoryStore,
  type ToolInvocationBlockedEvent,
  type ToolInvocationFailedEvent,
  type ToolInvocationObserver,
  type ToolInvocationStartedEvent,
  type ToolInvocationSucceededEvent,
  toolTelemetryMetadataKeys,
} from "@runroot/tools";

export interface CreateToolTelemetryObserverOptions {
  readonly history: ToolHistoryStore;
  readonly logger?: RunrootLogger;
  readonly surface: "operator" | "worker";
  readonly tracer?: RunrootTracer;
}

export function createToolTelemetryObserver(
  options: CreateToolTelemetryObserverOptions,
): ToolInvocationObserver {
  const history = options.history;
  const logger = (options.logger ?? createNoopLogger()).child({
    surface: options.surface,
  });
  const tracer = options.tracer ?? createNoopTracer();
  const spans = new Map<string, TraceSpan>();

  return {
    onInvocationStarted(event) {
      const attributes = buildObservationAttributes(event);

      logger.log({
        attributes,
        level: "info",
        message: "tool invocation started",
      });

      spans.set(
        event.callId,
        tracer.startSpan("tool.invoke", {
          attributes,
          startedAt: event.startedAt,
        }),
      );
    },

    async onInvocationBlocked(event) {
      await history.save(createBlockedToolHistoryEntry(event));
      finalizeInvocation(
        event,
        "blocked",
        event.decision.reason ?? "permission gate denied the request",
        "warn",
      );
    },

    async onInvocationFailed(event) {
      await history.save(createFailedToolHistoryEntry(event));
      finalizeInvocation(event, "failed", event.error.message, "error");
    },

    async onInvocationSucceeded(event) {
      await history.save(createSucceededToolHistoryEntry(event));
      finalizeInvocation(event, "succeeded", undefined, "info");
    },
  };

  function finalizeInvocation(
    event:
      | ToolInvocationBlockedEvent
      | ToolInvocationFailedEvent
      | ToolInvocationSucceededEvent,
    outcome: "blocked" | "failed" | "succeeded",
    detail: string | undefined,
    level: "error" | "info" | "warn",
  ): void {
    const attributes = buildObservationAttributes(event, outcome);
    const span = ensureSpan(event);

    if (detail) {
      span.addEvent(`tool.${outcome}`, {
        outcomeDetail: detail,
      });
    } else {
      span.addEvent(`tool.${outcome}`);
    }

    span.setAttributes({
      ...(detail ? { outcomeDetail: detail } : {}),
      outcome,
    });
    span.end(event.occurredAt);
    spans.delete(event.callId);

    logger.log({
      attributes: {
        ...attributes,
        ...(detail ? { outcomeDetail: detail } : {}),
      },
      level,
      message: `tool invocation ${outcome}`,
    });
  }

  function ensureSpan(
    event:
      | ToolInvocationBlockedEvent
      | ToolInvocationFailedEvent
      | ToolInvocationSucceededEvent,
  ): TraceSpan {
    const existingSpan = spans.get(event.callId);

    if (existingSpan) {
      return existingSpan;
    }

    const span = tracer.startSpan("tool.invoke", {
      attributes: buildObservationAttributes(event),
      startedAt: event.startedAt,
    });

    spans.set(event.callId, span);

    return span;
  }
}

function buildObservationAttributes(
  event:
    | ToolInvocationStartedEvent
    | ToolInvocationBlockedEvent
    | ToolInvocationFailedEvent
    | ToolInvocationSucceededEvent,
  outcome?: "blocked" | "failed" | "succeeded",
): ObservationAttributes {
  const metadata = event.context.metadata ?? {};

  return {
    ...(event.context.attempt === undefined
      ? {}
      : { attempt: event.context.attempt }),
    ...(metadata[toolTelemetryMetadataKeys.dispatchJobId]
      ? { dispatchJobId: metadata[toolTelemetryMetadataKeys.dispatchJobId] }
      : {}),
    ...(metadata[toolTelemetryMetadataKeys.executionMode]
      ? { executionMode: metadata[toolTelemetryMetadataKeys.executionMode] }
      : {}),
    ...(outcome ? { outcome } : {}),
    ...(event.context.runId ? { runId: event.context.runId } : {}),
    source: event.context.source,
    ...(event.context.stepId ? { stepId: event.context.stepId } : {}),
    toolCallId: event.callId,
    toolId: event.tool.id,
    toolName: event.tool.name,
    toolSource: event.tool.source,
    ...(metadata[toolTelemetryMetadataKeys.workerId]
      ? { workerId: metadata[toolTelemetryMetadataKeys.workerId] }
      : {}),
  };
}
