import { describe, expect, it, vi } from "vitest";

import type { ToolInvocationObserver } from "./contracts";
import {
  ToolInvocationError,
  ToolPermissionError,
  ToolValidationError,
} from "./errors";
import { createEchoTool } from "./examples";
import { createRegistryToolInvoker } from "./invoker";
import { createAllowlistToolPermissionGate } from "./permission";
import { createToolRegistry } from "./registry";

describe("@runroot/tools invoker", () => {
  it("invokes a registered tool and returns normalized output", async () => {
    const registry = createToolRegistry([createEchoTool()]);
    const invoker = createRegistryToolInvoker({
      callIdGenerator: () => "call_1",
      now: () => "2026-03-27T00:00:00.000Z",
      registry,
    });

    const result = await invoker.invoke(
      {
        input: {
          message: "hello",
          prefix: "safe:",
        },
        tool: {
          kind: "name",
          value: "echo",
        },
      },
      {
        runId: "run_1",
        source: "runtime",
        stepId: "step_1",
      },
    );

    expect(result).toEqual({
      callId: "call_1",
      finishedAt: "2026-03-27T00:00:00.000Z",
      output: {
        echoed: "safe:hello",
        tool: "echo",
      },
      startedAt: "2026-03-27T00:00:00.000Z",
      toolId: "builtin.echo",
      toolName: "echo",
    });
  });

  it("rejects invalid input before tool execution", async () => {
    const registry = createToolRegistry([createEchoTool()]);
    const invoker = createRegistryToolInvoker({
      registry,
    });

    await expect(
      invoker.invoke(
        {
          input: {
            prefix: "safe:",
          },
          tool: {
            kind: "name",
            value: "echo",
          },
        },
        {
          source: "test",
        },
      ),
    ).rejects.toThrow(ToolValidationError);
  });

  it("applies permission gates before invoking the tool", async () => {
    const registry = createToolRegistry([createEchoTool()]);
    const invoker = createRegistryToolInvoker({
      permissionGate: createAllowlistToolPermissionGate({
        toolNames: ["different-tool"],
      }),
      registry,
    });

    await expect(
      invoker.invoke(
        {
          input: {
            message: "hello",
          },
          tool: {
            kind: "name",
            value: "echo",
          },
        },
        {
          source: "test",
        },
      ),
    ).rejects.toThrow(ToolPermissionError);
  });

  it("rejects tool output that violates the declared result contract", async () => {
    const baseTool = createEchoTool();
    const registry = createToolRegistry([
      {
        ...baseTool,
        invoke: () => ({
          tool: "echo",
        }),
      },
    ]);
    const invoker = createRegistryToolInvoker({
      registry,
    });

    await expect(
      invoker.invoke(
        {
          input: {
            message: "hello",
          },
          tool: {
            kind: "name",
            value: "echo",
          },
        },
        {
          source: "test",
        },
      ),
    ).rejects.toThrow(ToolValidationError);
  });

  it("notifies observers about success, failure, and blocked calls", async () => {
    const baseTool = createEchoTool();
    const onInvocationBlocked = vi.fn();
    const onInvocationFailed = vi.fn();
    const onInvocationStarted = vi.fn();
    const onInvocationSucceeded = vi.fn();
    const observer: ToolInvocationObserver = {
      onInvocationBlocked,
      onInvocationFailed,
      onInvocationStarted,
      onInvocationSucceeded,
    };
    const registry = createToolRegistry([
      baseTool,
      {
        ...baseTool,
        invoke: () => {
          throw new Error("boom");
        },
        metadata: {
          ...baseTool.metadata,
          id: "builtin.broken",
          name: "broken",
        },
      },
    ]);
    const invoker = createRegistryToolInvoker({
      now: (() => {
        const timestamps = [
          "2026-03-27T00:00:00.000Z",
          "2026-03-27T00:00:01.000Z",
          "2026-03-27T00:00:02.000Z",
          "2026-03-27T00:00:03.000Z",
        ];

        return () => timestamps.shift() ?? "2026-03-27T00:00:04.000Z";
      })(),
      observer,
      registry,
    });

    await invoker.invoke(
      {
        input: {
          message: "hello",
        },
        tool: {
          kind: "name",
          value: "echo",
        },
      },
      {
        source: "test",
      },
    );

    await expect(
      invoker.invoke(
        {
          input: {
            message: "fail",
          },
          tool: {
            kind: "name",
            value: "broken",
          },
        },
        {
          source: "test",
        },
      ),
    ).rejects.toThrow(ToolInvocationError);

    const blockedInvoker = createRegistryToolInvoker({
      observer,
      permissionGate: createAllowlistToolPermissionGate({
        toolNames: ["different-tool"],
      }),
      registry,
    });

    await expect(
      blockedInvoker.invoke(
        {
          input: {
            message: "blocked",
          },
          tool: {
            kind: "name",
            value: "echo",
          },
        },
        {
          source: "test",
        },
      ),
    ).rejects.toThrow(ToolPermissionError);

    expect(observer.onInvocationStarted).toHaveBeenCalledTimes(2);
    expect(observer.onInvocationSucceeded).toHaveBeenCalledTimes(1);
    expect(observer.onInvocationFailed).toHaveBeenCalledTimes(1);
    expect(observer.onInvocationBlocked).toHaveBeenCalledTimes(1);
    const startedEvent = vi.mocked(onInvocationStarted).mock.calls.at(0)?.[0];
    const succeededEvent = vi
      .mocked(onInvocationSucceeded)
      .mock.calls.at(0)?.[0];
    const failedEvent = vi.mocked(onInvocationFailed).mock.calls.at(0)?.[0];

    expect(startedEvent).toBeDefined();
    expect(succeededEvent).toBeDefined();
    expect(failedEvent).toBeDefined();

    if (!startedEvent || !succeededEvent || !failedEvent) {
      throw new Error("Expected observer events to be recorded.");
    }

    expect(startedEvent.startedAt).toBe("2026-03-27T00:00:00.000Z");
    expect(succeededEvent.occurredAt).toBe("2026-03-27T00:00:01.000Z");
    expect(failedEvent.occurredAt).toBe("2026-03-27T00:00:03.000Z");
  });
});
