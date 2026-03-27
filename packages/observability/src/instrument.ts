import type {
  ObservationAttributes,
  RunrootTracer,
  TraceSpan,
  TraceSpanOptions,
} from "./contracts";

function buildErrorAttributes(error: unknown): ObservationAttributes {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
    };
  }

  return {
    errorMessage: String(error),
    errorName: "UnknownError",
  };
}

export async function withinSpan<TValue>(
  tracer: RunrootTracer,
  name: string,
  task: (span: TraceSpan) => Promise<TValue> | TValue,
  options: TraceSpanOptions = {},
): Promise<TValue> {
  const span = tracer.startSpan(name, options);

  try {
    const result = await task(span);

    span.setAttributes({
      status: "ok",
    });
    span.end();

    return result;
  } catch (error) {
    span.addEvent("error", buildErrorAttributes(error));
    span.setAttributes({
      status: "error",
    });
    span.end();
    throw error;
  }
}
