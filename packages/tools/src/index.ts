import type { PackageBoundary } from "@runroot/config";

export type {
  ToolDefinition,
  ToolExecutionContext,
  ToolInvocationBlockedEvent,
  ToolInvocationContext,
  ToolInvocationFailedEvent,
  ToolInvocationObserver,
  ToolInvocationRequest,
  ToolInvocationResult,
  ToolInvocationStartedEvent,
  ToolInvocationSucceededEvent,
  ToolInvoker,
  ToolMetadata,
  ToolOutputContract,
  ToolPermissionDecision,
  ToolPermissionGate,
  ToolPermissionRequest,
  ToolReference,
  ToolReferenceById,
  ToolReferenceByName,
} from "./contracts";
export {
  DuplicateToolRegistrationError,
  InvalidToolDefinitionError,
  ToolError,
  ToolInvocationError,
  ToolNotFoundError,
  ToolPermissionError,
  ToolValidationError,
} from "./errors";
export { createEchoTool } from "./examples";
export type {
  ToolExecutionMode,
  ToolHistoryEntry,
  ToolHistoryOutcome,
  ToolHistoryStore,
} from "./history";
export {
  createBlockedToolHistoryEntry,
  createFailedToolHistoryEntry,
  createSucceededToolHistoryEntry,
  summarizeToolValue,
  toolTelemetryMetadataKeys,
} from "./history";
export {
  createRegistryToolInvoker,
  createUnavailableToolInvoker,
  type RegistryToolInvokerOptions,
} from "./invoker";
export { withToolInvocationMetadata } from "./metadata";
export {
  type AllowlistToolPermissionGateOptions,
  allowAllToolPermissionGate,
  createAllowlistToolPermissionGate,
} from "./permission";
export { createToolRegistry, type ToolRegistry } from "./registry";
export type {
  ToolArraySchema,
  ToolBooleanSchema,
  ToolJsonSchema,
  ToolNullSchema,
  ToolNumberSchema,
  ToolObjectSchema,
  ToolSchema,
  ToolSchemaType,
  ToolStringSchema,
} from "./schema";
export { validateToolValue } from "./schema";

export const toolsPackageBoundary = {
  name: "@runroot/tools",
  kind: "package",
  phaseOwned: 3,
  responsibility:
    "Tool registry, invocation contracts, allowlists, and normalized results.",
  publicSurface: [
    "tool definition contract",
    "tool registry",
    "tool invoker",
    "tool history contract",
    "permission policy",
  ],
} as const satisfies PackageBoundary;
