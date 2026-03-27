import { createRegistryToolInvoker, createToolRegistry } from "@runroot/tools";
import { describe, expect, it, vi } from "vitest";

import { adaptMcpToolDescriptor, adaptMcpTools } from "./adapter";
import type { McpToolClient, McpToolDescriptor } from "./contracts";

describe("@runroot/mcp adapter", () => {
  it("maps an MCP descriptor into an internal tool definition", async () => {
    const client: McpToolClient = {
      callTool: vi.fn(async () => ({
        output: {
          greeting: "hello runroot",
        },
      })),
      listTools: vi.fn(async () => []),
    };
    const tool = adaptMcpToolDescriptor(
      client,
      {
        description: "Return a greeting.",
        inputSchema: {
          additionalProperties: false,
          properties: {
            name: {
              type: "string",
            },
          },
          required: ["name"],
          type: "object",
        },
        name: "greeter",
        output: {
          schema: {
            additionalProperties: false,
            properties: {
              greeting: {
                type: "string",
              },
            },
            required: ["greeting"],
            type: "object",
          },
        },
      },
      {
        providerId: "mock",
      },
    );

    expect(tool.metadata.id).toBe("mcp.mock.greeter");
    expect(tool.metadata.name).toBe("greeter");

    const result = await tool.invoke({
      context: {
        source: "test",
      },
      input: {
        name: "runroot",
      },
      request: {
        input: {
          name: "runroot",
        },
        tool: {
          kind: "name",
          value: "greeter",
        },
      },
    });

    expect(result).toEqual({
      greeting: "hello runroot",
    });
  });

  it("adapts discovered MCP tools and invokes them through the shared tool invoker", async () => {
    const greeterDescriptor = {
      capabilities: ["mcp.remote"],
      description: "Return a greeting.",
      inputSchema: {
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
          },
        },
        required: ["name"],
        type: "object",
      },
      name: "greeter",
      output: {
        schema: {
          additionalProperties: false,
          properties: {
            greeting: {
              type: "string",
            },
            provider: {
              type: "string",
            },
          },
          required: ["greeting", "provider"],
          type: "object",
        },
      },
      tags: ["example"],
    } as const satisfies McpToolDescriptor;
    const client: McpToolClient = {
      callTool: vi.fn(async (request) => ({
        output: {
          greeting: `hello ${String((request.input as Record<string, unknown>).name)}`,
          provider: "mock",
        },
      })),
      listTools: vi.fn(async () => [greeterDescriptor]),
    };
    const registry = createToolRegistry();

    for (const tool of await adaptMcpTools(client, {
      namePrefix: "mcp",
      providerId: "mock",
      tags: ["mcp"],
    })) {
      registry.register(tool);
    }

    const invoker = createRegistryToolInvoker({
      registry,
    });
    const result = await invoker.invoke(
      {
        input: {
          name: "runroot",
        },
        tool: {
          kind: "name",
          value: "mcp.greeter",
        },
      },
      {
        source: "runtime",
      },
    );

    expect(result.output).toEqual({
      greeting: "hello runroot",
      provider: "mock",
    });
    expect(client.listTools).toHaveBeenCalledTimes(1);
    expect(client.callTool).toHaveBeenCalledTimes(1);
  });
});
