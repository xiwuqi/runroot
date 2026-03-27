import type {
  LogRecord,
  ObservationAttributes,
  RunrootLogger,
} from "./contracts";

interface LoggerOptions {
  readonly attributes?: ObservationAttributes;
  readonly now?: () => string;
}

function mergeAttributes(
  base: ObservationAttributes | undefined,
  next: ObservationAttributes | undefined,
): ObservationAttributes | undefined {
  if (!base && !next) {
    return undefined;
  }

  return {
    ...(base ?? {}),
    ...(next ?? {}),
  };
}

export function createNoopLogger(options: LoggerOptions = {}): RunrootLogger {
  return createChildLogger(options, () => undefined);
}

export interface MemoryLogger extends RunrootLogger {
  readonly records: readonly LogRecord[];
}

export function createMemoryLogger(options: LoggerOptions = {}): MemoryLogger {
  const records: LogRecord[] = [];
  const logger = createChildLogger(options, (record) => {
    records.push(record);
  }) as MemoryLogger;

  Object.defineProperty(logger, "records", {
    get() {
      return records;
    },
  });

  return logger;
}

export function createConsoleLogger(
  options: LoggerOptions = {},
): RunrootLogger {
  return createChildLogger(options, (record) => {
    const method =
      record.level === "debug"
        ? "debug"
        : record.level === "info"
          ? "info"
          : record.level === "warn"
            ? "warn"
            : "error";

    console[method](
      `${record.timestamp} ${record.level.toUpperCase()} ${record.message}`,
      record.attributes ?? {},
    );
  });
}

function createChildLogger(
  options: LoggerOptions,
  sink: (record: LogRecord) => void,
): RunrootLogger {
  const now = options.now ?? (() => new Date().toISOString());
  const baseAttributes = options.attributes;

  return {
    child(attributes) {
      const mergedAttributes = mergeAttributes(baseAttributes, attributes);

      return createChildLogger(
        mergedAttributes
          ? {
              attributes: mergedAttributes,
              now,
            }
          : {
              now,
            },
        sink,
      );
    },
    log(record) {
      const attributes = mergeAttributes(baseAttributes, record.attributes);

      sink({
        ...(attributes ? { attributes } : {}),
        level: record.level,
        message: record.message,
        timestamp: record.timestamp ?? now(),
      });
    },
  };
}
