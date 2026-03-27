# @runroot/mcp

Owns MCP client sessions, tool discovery, and protocol translation into the shared tool contract.

Phase 3 exports:

- a minimal `McpToolClient` contract
- adapters that translate MCP tool descriptors into `@runroot/tools` definitions

Example:

```ts
import { adaptMcpTools } from "@runroot/mcp";
import { createRegistryToolInvoker, createToolRegistry } from "@runroot/tools";

const client = {
  async listTools() {
    return [
      {
        description: "Return a greeting from an MCP-backed tool.",
        inputSchema: {
          properties: {
            name: {
              type: "string",
            },
          },
          required: ["name"],
          type: "object",
        },
        name: "greeter",
      },
    ] as const;
  },
  async callTool(request) {
    return {
      output: {
        greeting: `hello ${String(request.input.name)}`,
      },
    };
  },
};

const registry = createToolRegistry();
for (const tool of await adaptMcpTools(client, { providerId: "docs" })) {
  registry.register(tool);
}

const tools = createRegistryToolInvoker({ registry });
```
