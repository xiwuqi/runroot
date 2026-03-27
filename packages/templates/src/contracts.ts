import type { WorkflowDefinition } from "@runroot/core-runtime";
import type { JsonValue } from "@runroot/domain";
import type { ToolInvoker, ToolSchema } from "@runroot/tools";

export interface WorkflowTemplateDescriptor {
  readonly description: string;
  readonly id: string;
  readonly inputExample: JsonValue;
  readonly inputSchema: ToolSchema;
  readonly name: string;
  readonly requiresApproval: boolean;
  readonly toolReferences: readonly string[];
  readonly usesMcp: boolean;
}

export interface WorkflowTemplate {
  readonly definition: WorkflowDefinition;
  readonly descriptor: WorkflowTemplateDescriptor;
}

export interface TemplateCatalog {
  get(templateId: string): WorkflowTemplate | undefined;
  list(): readonly WorkflowTemplate[];
  require(templateId: string): WorkflowTemplate;
}

export interface TemplateRuntimeBundle {
  readonly templates: TemplateCatalog;
  readonly toolInvoker: ToolInvoker;
}
