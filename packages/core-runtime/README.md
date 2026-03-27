# @runroot/core-runtime

Owns workflow orchestration, state transitions, retry policy, checkpoint semantics, and pause/resume behavior.

Phase 2 exports:

- workflow definition and step execution contracts
- a synchronous runtime engine with retry, pause/resume, and atomic transition persistence
- run and event query helpers backed by the persistence abstraction
- a stable seam for tool invocation through step context

`pauseRun` is intentionally narrow in Phase 2: it is only valid after a run has entered `queued` or `running`. Pending runs must be started with `executeRun` first.

Example:

```ts
import { RuntimeEngine, completeStep } from "@runroot/core-runtime";
import { createInMemoryRuntimePersistence } from "@runroot/persistence";
import { createEchoTool, createRegistryToolInvoker, createToolRegistry } from "@runroot/tools";

const registry = createToolRegistry();
registry.register(createEchoTool());

const runtime = new RuntimeEngine({
  persistence: createInMemoryRuntimePersistence(),
  toolInvoker: createRegistryToolInvoker({ registry }),
});

const definition = {
  id: "workflow.example",
  name: "Example workflow",
  steps: [
    {
      execute: async (context) => {
        const toolResult = await context.tools.invoke(
          {
            input: {
              message: "ok",
            },
            tool: {
              kind: "name",
              value: "echo",
            },
          },
          {
            runId: context.run.id,
            source: "runtime",
            stepId: context.step.id,
          },
        );

        return completeStep(toolResult.output);
      },
      key: "prepare",
      name: "Prepare",
    },
  ],
  version: "0.1.0",
};

const run = await runtime.createRun(definition, { trigger: "docs" });
await runtime.executeRun(definition, run.id);
```
