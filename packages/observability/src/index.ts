import type { PackageBoundary } from "@runroot/config";

export type {
  LogLevel,
  LogRecord,
  ObservabilityAdapters,
  ObservationAttributes,
  ObservationValue,
  RunrootLogger,
  RunrootTracer,
  TraceEvent,
  TraceSpan,
  TraceSpanOptions,
  TraceSpanRecord,
} from "./contracts";
export { withinSpan } from "./instrument";
export {
  createConsoleLogger,
  createMemoryLogger,
  createNoopLogger,
  type MemoryLogger,
} from "./logger";
export {
  createMemoryTracer,
  createNoopTracer,
  type MemoryTracer,
} from "./tracer";

export const observabilityPackageBoundary = {
  name: "@runroot/observability",
  kind: "package",
  phaseOwned: 6,
  responsibility: "Logging, tracing, and telemetry adapter contracts.",
  publicSurface: ["logger adapters", "trace hooks", "telemetry contracts"],
} as const satisfies PackageBoundary;
