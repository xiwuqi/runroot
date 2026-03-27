import { describe, expect, it } from "vitest";
import { withinSpan } from "./instrument";
import { createMemoryLogger } from "./logger";
import { createMemoryTracer } from "./tracer";

describe("@runroot/observability", () => {
  it("records log events with inherited attributes", () => {
    const rootLogger = createMemoryLogger({
      now: () => "2026-03-27T18:00:00.000Z",
    });
    const logger = rootLogger.child({
      service: "web",
    });

    logger.log({
      attributes: {
        route: "/runs",
      },
      level: "info",
      message: "loaded runs",
    });

    expect(rootLogger.records).toEqual([
      {
        attributes: {
          route: "/runs",
          service: "web",
        },
        level: "info",
        message: "loaded runs",
        timestamp: "2026-03-27T18:00:00.000Z",
      },
    ]);
  });

  it("records spans, attributes, and events around async work", async () => {
    const timestamps = [
      "2026-03-27T18:00:00.000Z",
      "2026-03-27T18:00:01.000Z",
      "2026-03-27T18:00:02.000Z",
    ];
    const tracer = createMemoryTracer({
      now: () => timestamps.shift() ?? "2026-03-27T18:00:03.000Z",
    });

    await withinSpan(tracer, "web.fetchRuns", async (span) => {
      span.setAttributes({
        route: "/runs",
      });
      span.addEvent("response", {
        statusCode: 200,
      });
    });

    expect(tracer.spans).toHaveLength(1);
    expect(tracer.spans[0]).toMatchObject({
      attributes: {
        route: "/runs",
        status: "ok",
      },
      endedAt: "2026-03-27T18:00:02.000Z",
      name: "web.fetchRuns",
      startedAt: "2026-03-27T18:00:00.000Z",
    });
    expect(tracer.spans[0]?.events).toEqual([
      {
        attributes: {
          statusCode: 200,
        },
        name: "response",
        occurredAt: "2026-03-27T18:00:01.000Z",
      },
    ]);
  });
});
