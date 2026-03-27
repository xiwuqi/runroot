import type { ToolDefinition } from "./contracts";

export function createEchoTool(): ToolDefinition {
  return {
    inputSchema: {
      additionalProperties: false,
      properties: {
        message: {
          minLength: 1,
          type: "string",
        },
        prefix: {
          type: "string",
        },
      },
      required: ["message"],
      type: "object",
    },
    invoke: ({ input }) => {
      const echoInput = input as {
        readonly message: string;
        readonly prefix?: string;
      };

      return {
        echoed: echoInput.prefix
          ? `${echoInput.prefix}${echoInput.message}`
          : echoInput.message,
        tool: "echo",
      };
    },
    metadata: {
      capabilities: ["local.safe"],
      description: "Echo a message back as structured JSON.",
      id: "builtin.echo",
      name: "echo",
      source: "builtin",
      tags: ["builtin", "example", "safe"],
    },
    output: {
      description: "Structured echo result.",
      schema: {
        additionalProperties: false,
        properties: {
          echoed: {
            type: "string",
          },
          tool: {
            type: "string",
          },
        },
        required: ["echoed", "tool"],
        type: "object",
      },
    },
  };
}
