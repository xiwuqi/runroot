import type { ToolDefinition, ToolReference } from "./contracts";
import {
  DuplicateToolRegistrationError,
  InvalidToolDefinitionError,
  ToolNotFoundError,
} from "./errors";

export interface ToolRegistry {
  get(reference: ToolReference): ToolDefinition | undefined;
  getById(toolId: string): ToolDefinition | undefined;
  getByName(toolName: string): ToolDefinition | undefined;
  list(): readonly ToolDefinition[];
  register(tool: ToolDefinition): ToolDefinition;
  require(reference: ToolReference): ToolDefinition;
}

export function createToolRegistry(
  initialTools: readonly ToolDefinition[] = [],
): ToolRegistry {
  return new InMemoryToolRegistry(initialTools);
}

class InMemoryToolRegistry implements ToolRegistry {
  readonly #toolsById = new Map<string, ToolDefinition>();
  readonly #toolIdsByName = new Map<string, string>();

  constructor(initialTools: readonly ToolDefinition[]) {
    for (const tool of initialTools) {
      this.register(tool);
    }
  }

  get(reference: ToolReference): ToolDefinition | undefined {
    return reference.kind === "id"
      ? this.getById(reference.value)
      : this.getByName(reference.value);
  }

  getById(toolId: string): ToolDefinition | undefined {
    return this.#toolsById.get(toolId);
  }

  getByName(toolName: string): ToolDefinition | undefined {
    const toolId = this.#toolIdsByName.get(toolName);

    return toolId ? this.#toolsById.get(toolId) : undefined;
  }

  list(): readonly ToolDefinition[] {
    return [...this.#toolsById.values()];
  }

  register(tool: ToolDefinition): ToolDefinition {
    assertValidToolDefinition(tool);

    if (
      this.#toolsById.has(tool.metadata.id) ||
      this.#toolIdsByName.has(tool.metadata.name)
    ) {
      throw new DuplicateToolRegistrationError(
        tool.metadata.id,
        tool.metadata.name,
      );
    }

    this.#toolsById.set(tool.metadata.id, tool);
    this.#toolIdsByName.set(tool.metadata.name, tool.metadata.id);

    return tool;
  }

  require(reference: ToolReference): ToolDefinition {
    const tool = this.get(reference);

    if (tool) {
      return tool;
    }

    throw new ToolNotFoundError(reference.value);
  }
}

function assertValidToolDefinition(tool: ToolDefinition): void {
  if (!tool.metadata.id.trim()) {
    throw new InvalidToolDefinitionError("Tool id must not be empty.");
  }

  if (!tool.metadata.name.trim()) {
    throw new InvalidToolDefinitionError("Tool name must not be empty.");
  }

  if (!tool.metadata.description.trim()) {
    throw new InvalidToolDefinitionError(
      `Tool "${tool.metadata.name}" must declare a description.`,
    );
  }

  if (!tool.metadata.source.trim()) {
    throw new InvalidToolDefinitionError(
      `Tool "${tool.metadata.name}" must declare a source.`,
    );
  }

  if (!tool.output.description.trim()) {
    throw new InvalidToolDefinitionError(
      `Tool "${tool.metadata.name}" must declare an output description.`,
    );
  }
}
