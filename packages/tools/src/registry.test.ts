import { describe, expect, it } from "vitest";
import {
  DuplicateToolRegistrationError,
  InvalidToolDefinitionError,
  ToolNotFoundError,
} from "./errors";
import { createEchoTool } from "./examples";
import { createToolRegistry } from "./registry";

describe("@runroot/tools registry", () => {
  it("registers tools and resolves them by id and name", () => {
    const registry = createToolRegistry();
    const tool = createEchoTool();

    registry.register(tool);

    expect(registry.getById(tool.metadata.id)).toEqual(tool);
    expect(registry.getByName(tool.metadata.name)).toEqual(tool);
    expect(registry.list()).toEqual([tool]);
  });

  it("rejects duplicate tool registrations", () => {
    const registry = createToolRegistry();
    const tool = createEchoTool();

    registry.register(tool);

    expect(() => registry.register(tool)).toThrow(
      DuplicateToolRegistrationError,
    );
  });

  it("rejects invalid tool definitions", () => {
    const registry = createToolRegistry();
    const tool = createEchoTool();

    expect(() =>
      registry.register({
        ...tool,
        metadata: {
          ...tool.metadata,
          name: "",
        },
      }),
    ).toThrow(InvalidToolDefinitionError);
  });

  it("throws a clear error when a tool is missing", () => {
    const registry = createToolRegistry();

    expect(() =>
      registry.require({
        kind: "name",
        value: "missing",
      }),
    ).toThrow(ToolNotFoundError);
  });
});
