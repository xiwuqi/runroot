import type { ToolDefinition, ToolOutputContract } from "@runroot/tools";

import type {
  McpToolAdapterOptions,
  McpToolClient,
  McpToolDescriptor,
} from "./contracts";

export async function adaptMcpTools(
  client: McpToolClient,
  options: McpToolAdapterOptions = {},
): Promise<readonly ToolDefinition[]> {
  const descriptors = await client.listTools();

  return descriptors.map((descriptor) =>
    adaptMcpToolDescriptor(client, descriptor, options),
  );
}

export function adaptMcpToolDescriptor(
  client: McpToolClient,
  descriptor: McpToolDescriptor,
  options: McpToolAdapterOptions = {},
): ToolDefinition {
  const toolName = options.namePrefix
    ? `${options.namePrefix}.${descriptor.name}`
    : descriptor.name;
  const providerId = options.providerId ?? "default";
  const capabilities = mergeValues(
    descriptor.capabilities,
    options.capabilities,
  );
  const tags = mergeValues(descriptor.tags, options.tags);

  return {
    inputSchema: descriptor.inputSchema,
    invoke: async ({ context, input }) => {
      const result = await client.callTool({
        context,
        input,
        name: descriptor.name,
      });

      return result.output;
    },
    metadata: {
      description: descriptor.description,
      id: `mcp.${providerId}.${descriptor.name}`,
      name: toolName,
      source: "mcp",
      ...(capabilities ? { capabilities } : {}),
      ...(tags ? { tags } : {}),
    },
    output: normalizeOutputContract(descriptor),
  };
}

function mergeValues(
  first?: readonly string[],
  second?: readonly string[],
): readonly string[] | undefined {
  const mergedValues = [...(first ?? []), ...(second ?? [])];

  if (mergedValues.length === 0) {
    return undefined;
  }

  return [...new Set(mergedValues)];
}

function normalizeOutputContract(
  descriptor: McpToolDescriptor,
): ToolOutputContract {
  return {
    description:
      descriptor.output?.description ??
      `Normalized output returned by MCP tool "${descriptor.name}".`,
    schema: descriptor.output?.schema ?? {
      type: "json",
    },
  };
}
