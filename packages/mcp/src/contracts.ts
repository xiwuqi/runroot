import type { JsonValue } from "@runroot/domain";
import type {
  ToolInvocationContext,
  ToolOutputContract,
  ToolSchema,
} from "@runroot/tools";

export interface McpToolDescriptor {
  readonly capabilities?: readonly string[];
  readonly description: string;
  readonly inputSchema: ToolSchema;
  readonly name: string;
  readonly output?: Partial<ToolOutputContract>;
  readonly tags?: readonly string[];
}

export interface McpToolCallRequest {
  readonly context: ToolInvocationContext;
  readonly input: JsonValue;
  readonly name: string;
}

export interface McpToolCallResult {
  readonly output: JsonValue;
}

export interface McpToolClient {
  callTool(request: McpToolCallRequest): Promise<McpToolCallResult>;
  listTools(): Promise<readonly McpToolDescriptor[]>;
}

export interface McpToolAdapterOptions {
  readonly capabilities?: readonly string[];
  readonly namePrefix?: string;
  readonly providerId?: string;
  readonly tags?: readonly string[];
}
