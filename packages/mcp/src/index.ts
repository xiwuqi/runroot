import type { PackageBoundary } from "@runroot/config";

export { adaptMcpToolDescriptor, adaptMcpTools } from "./adapter";
export type {
  McpToolAdapterOptions,
  McpToolCallRequest,
  McpToolCallResult,
  McpToolClient,
  McpToolDescriptor,
} from "./contracts";

export const mcpPackageBoundary = {
  name: "@runroot/mcp",
  kind: "package",
  phaseOwned: 3,
  responsibility:
    "MCP transport, discovery, and translation into shared tool contracts.",
  publicSurface: ["MCP adapters", "tool discovery", "tool translation"],
} as const satisfies PackageBoundary;
