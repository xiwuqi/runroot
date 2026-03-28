import type {
  ToolInvocationContext,
  ToolInvocationRequest,
  ToolInvoker,
} from "./contracts";

export function withToolInvocationMetadata(
  baseInvoker: ToolInvoker,
  metadata: Readonly<Record<string, string>>,
): ToolInvoker {
  return {
    invoke(request: ToolInvocationRequest, context: ToolInvocationContext) {
      return baseInvoker.invoke(request, {
        ...context,
        metadata: {
          ...metadata,
          ...(context.metadata ?? {}),
        },
      });
    },
  };
}
