import type { PackageBoundary } from "@runroot/config";

export const mcpPackageBoundary = {
  name: "@runroot/mcp",
  kind: "package",
  phaseOwned: 3,
  responsibility:
    "MCP transport, discovery, and translation into shared tool contracts.",
  publicSurface: ["MCP adapters", "session management", "tool discovery"],
} as const satisfies PackageBoundary;
