export type LogLevel = "debug" | "error" | "info" | "warn";

export type ObservationValue = boolean | null | number | string;

export type ObservationAttributes = Readonly<Record<string, ObservationValue>>;

export interface LogRecord {
  readonly attributes?: ObservationAttributes;
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
}

export interface RunrootLogger {
  child(attributes: ObservationAttributes): RunrootLogger;
  log(
    record: Omit<LogRecord, "timestamp"> &
      Partial<Pick<LogRecord, "timestamp">>,
  ): void;
}

export interface TraceSpan {
  addEvent(name: string, attributes?: ObservationAttributes): void;
  end(endedAt?: string): void;
  setAttributes(attributes: ObservationAttributes): void;
}

export interface TraceSpanOptions {
  readonly attributes?: ObservationAttributes;
  readonly startedAt?: string;
}

export interface TraceEvent {
  readonly attributes?: ObservationAttributes;
  readonly name: string;
  readonly occurredAt: string;
}

export interface TraceSpanRecord {
  readonly attributes: ObservationAttributes;
  readonly endedAt?: string;
  readonly events: readonly TraceEvent[];
  readonly name: string;
  readonly startedAt: string;
}

export interface RunrootTracer {
  startSpan(name: string, options?: TraceSpanOptions): TraceSpan;
}

export interface ObservabilityAdapters {
  readonly logger: RunrootLogger;
  readonly tracer: RunrootTracer;
}
