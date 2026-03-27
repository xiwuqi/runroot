import { describe, expect, it } from "vitest";

import { createEchoTool } from "./examples";
import { createAllowlistToolPermissionGate } from "./permission";

describe("@runroot/tools permissions", () => {
  it("allows a tool when its name is allowlisted", () => {
    const gate = createAllowlistToolPermissionGate({
      toolNames: ["echo"],
    });

    expect(
      gate.evaluate({
        context: {
          source: "test",
        },
        request: {
          input: {
            message: "hello",
          },
          tool: {
            kind: "name",
            value: "echo",
          },
        },
        tool: createEchoTool(),
      }),
    ).toEqual({
      allowed: true,
    });
  });

  it("blocks a tool when its capability is not allowlisted", () => {
    const gate = createAllowlistToolPermissionGate({
      capabilities: ["mcp.remote"],
    });

    expect(
      gate.evaluate({
        context: {
          source: "test",
        },
        request: {
          input: {
            message: "hello",
          },
          tool: {
            kind: "name",
            value: "echo",
          },
        },
        tool: createEchoTool(),
      }),
    ).toEqual({
      allowed: false,
      reason: "tool capabilities must include one of mcp.remote",
    });
  });
});
