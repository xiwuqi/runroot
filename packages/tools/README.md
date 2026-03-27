# @runroot/tools

Owns the shared tool registry contract, invocation model, permission gates, and result normalization boundary.

Phase 3 exports:

- `ToolDefinition` and schema contracts
- `ToolRegistry` for registration and lookup
- `ToolInvoker` and a registry-backed invoker implementation
- minimal allowlist permission gates
- example local tools

Example:

```ts
import {
  createAllowlistToolPermissionGate,
  createEchoTool,
  createRegistryToolInvoker,
  createToolRegistry,
} from "@runroot/tools";

const registry = createToolRegistry();
registry.register(createEchoTool());

const tools = createRegistryToolInvoker({
  permissionGate: createAllowlistToolPermissionGate({
    toolNames: ["echo"],
  }),
  registry,
});

const result = await tools.invoke(
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
    source: "docs",
  },
);

console.log(result.output);
```
