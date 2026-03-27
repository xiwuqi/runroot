import type {
  ObservationAttributes,
  RunrootTracer,
  TraceEvent,
  TraceSpan,
  TraceSpanOptions,
  TraceSpanRecord,
} from "./contracts";

interface TracerOptions {
  readonly now?: () => string;
}

function mergeAttributes(
  base: ObservationAttributes | undefined,
  next: ObservationAttributes | undefined,
): ObservationAttributes {
  return {
    ...(base ?? {}),
    ...(next ?? {}),
  };
}

export function createNoopTracer(): RunrootTracer {
  return {
    startSpan() {
      return {
        addEvent() {},
        end() {},
        setAttributes() {},
      };
    },
  };
}

export interface MemoryTracer extends RunrootTracer {
  readonly spans: readonly TraceSpanRecord[];
}

export function createMemoryTracer(options: TracerOptions = {}): MemoryTracer {
  const spans: TraceSpanRecord[] = [];
  const now = options.now ?? (() => new Date().toISOString());

  const tracer = {
    startSpan(name: string, spanOptions: TraceSpanOptions = {}): TraceSpan {
      const record: {
        attributes: ObservationAttributes;
        endedAt?: string;
        events: TraceEvent[];
        name: string;
        startedAt: string;
      } = {
        attributes: mergeAttributes(undefined, spanOptions.attributes),
        events: [],
        name,
        startedAt: spanOptions.startedAt ?? now(),
      };

      spans.push(record);

      return {
        addEvent(eventName, attributes) {
          record.events.push({
            ...(attributes ? { attributes } : {}),
            name: eventName,
            occurredAt: now(),
          });
        },
        end(endedAt) {
          record.endedAt = endedAt ?? now();
        },
        setAttributes(attributes) {
          record.attributes = mergeAttributes(record.attributes, attributes);
        },
      };
    },
  } as MemoryTracer;

  Object.defineProperty(tracer, "spans", {
    get() {
      return spans;
    },
  });

  return tracer;
}
