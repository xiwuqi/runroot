import type {
  ToolPermissionDecision,
  ToolPermissionGate,
  ToolPermissionRequest,
} from "./contracts";

export interface AllowlistToolPermissionGateOptions {
  readonly capabilities?: readonly string[];
  readonly tags?: readonly string[];
  readonly toolIds?: readonly string[];
  readonly toolNames?: readonly string[];
}

export const allowAllToolPermissionGate: ToolPermissionGate = {
  evaluate() {
    return {
      allowed: true,
    };
  },
};

export function createAllowlistToolPermissionGate(
  options: AllowlistToolPermissionGateOptions,
): ToolPermissionGate {
  const toolIds = new Set(options.toolIds ?? []);
  const toolNames = new Set(options.toolNames ?? []);
  const capabilities = new Set(options.capabilities ?? []);
  const tags = new Set(options.tags ?? []);

  return {
    evaluate(request: ToolPermissionRequest): ToolPermissionDecision {
      const reasons: string[] = [];
      const { tool } = request;

      if (toolIds.size > 0 && !toolIds.has(tool.metadata.id)) {
        reasons.push(`id "${tool.metadata.id}" is not allowlisted`);
      }

      if (toolNames.size > 0 && !toolNames.has(tool.metadata.name)) {
        reasons.push(`name "${tool.metadata.name}" is not allowlisted`);
      }

      if (
        capabilities.size > 0 &&
        !hasIntersection(tool.metadata.capabilities ?? [], capabilities)
      ) {
        reasons.push(
          `tool capabilities must include one of ${[...capabilities].join(", ")}`,
        );
      }

      if (tags.size > 0 && !hasIntersection(tool.metadata.tags ?? [], tags)) {
        reasons.push(`tool tags must include one of ${[...tags].join(", ")}`);
      }

      if (reasons.length === 0) {
        return {
          allowed: true,
        };
      }

      return {
        allowed: false,
        reason: reasons.join("; "),
      };
    },
  };
}

function hasIntersection(
  values: readonly string[],
  allowlist: ReadonlySet<string>,
): boolean {
  return values.some((value) => allowlist.has(value));
}
