import { createMemoryLogger, createMemoryTracer } from "@runroot/observability";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRunrootApiClient } from "./runroot-api";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("@runroot/web runroot api client", () => {
  it("loads runs through the API and records observability hooks", async () => {
    const logger = createMemoryLogger({
      now: () => "2026-03-27T19:00:00.000Z",
    });
    const tracer = createMemoryTracer({
      now: () => "2026-03-27T19:00:00.000Z",
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          runs: [
            {
              createdAt: "2026-03-27T18:00:00.000Z",
              currentStepIndex: 0,
              definitionId: "shell-runbook-flow",
              definitionName: "Shell runbook flow",
              definitionVersion: "0.0.0",
              id: "run_1",
              metadata: {},
              status: "succeeded",
              updatedAt: "2026-03-27T18:00:01.000Z",
            },
          ],
        }),
        {
          status: 200,
        },
      ),
    ) as typeof fetch;

    const client = createRunrootApiClient({
      baseUrl: "http://127.0.0.1:3001",
      logger,
      tracer,
    });
    const runs = await client.listRuns();

    expect(runs[0]?.id).toBe("run_1");
    expect(logger.records.map((record) => record.message)).toContain(
      "runroot api request completed",
    );
    expect(tracer.spans[0]?.name).toBe("web.api.listRuns");
    expect(tracer.spans[0]?.events[0]?.name).toBe("response");
  });

  it("raises RunrootApiError on non-success responses", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("missing", {
        status: 404,
      }),
    ) as typeof fetch;

    const client = createRunrootApiClient({
      baseUrl: "http://127.0.0.1:3001",
    });

    await expect(client.getRun("run_missing")).rejects.toMatchObject({
      name: "RunrootApiError",
      path: "/runs/run_missing",
      statusCode: 404,
    });
  });
});
