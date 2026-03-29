import type { CrossRunAuditQueryFilters } from "./cross-run";
import type { CrossRunAuditDrilldownFilters } from "./drilldown";
import type {
  CrossRunAuditNavigationFilters,
  CrossRunAuditNavigationView,
} from "./navigation";

export type CrossRunAuditSavedViewKind = "operator-preset" | "saved-view";

export interface CrossRunAuditSavedViewNavigationRefs {
  readonly auditViewRunId?: string;
  readonly drilldownRunId?: string;
}

export interface CrossRunAuditSavedView {
  readonly createdAt: string;
  readonly description?: string;
  readonly id: string;
  readonly kind: CrossRunAuditSavedViewKind;
  readonly name: string;
  readonly navigation: CrossRunAuditNavigationFilters;
  readonly refs: CrossRunAuditSavedViewNavigationRefs;
  readonly updatedAt: string;
}

export interface CreateCrossRunAuditSavedViewInput {
  readonly description?: string;
  readonly id: string;
  readonly kind?: CrossRunAuditSavedViewKind;
  readonly name: string;
  readonly navigation?: Partial<CrossRunAuditNavigationFilters>;
  readonly refs?: CrossRunAuditSavedViewNavigationRefs;
  readonly timestamp: string;
}

export interface CrossRunAuditSavedViewCollection {
  readonly items: readonly CrossRunAuditSavedView[];
  readonly totalCount: number;
}

export interface CrossRunAuditSavedViewApplication {
  readonly navigation: CrossRunAuditNavigationView;
  readonly savedView: CrossRunAuditSavedView;
}

export interface CrossRunAuditSavedViewStore {
  getSavedView(id: string): Promise<CrossRunAuditSavedView | undefined>;
  listSavedViews(): Promise<readonly CrossRunAuditSavedView[]>;
  saveSavedView(
    savedView: CrossRunAuditSavedView,
  ): Promise<CrossRunAuditSavedView>;
}

export function createCrossRunAuditSavedView(
  input: CreateCrossRunAuditSavedViewInput,
): CrossRunAuditSavedView {
  const name = input.name.trim();

  if (name.length === 0) {
    throw new Error("Saved audit views require a non-empty name.");
  }

  const navigation = normalizeCrossRunAuditNavigationFilters(input.navigation);
  const refs = normalizeCrossRunAuditSavedViewRefs(input.refs);

  if (!hasCrossRunAuditSavedViewState(navigation, refs)) {
    throw new Error(
      "Saved audit views require at least one stable filter or navigation reference.",
    );
  }

  const description = input.description?.trim();

  return {
    createdAt: input.timestamp,
    ...(description ? { description } : {}),
    id: input.id,
    kind: input.kind ?? "saved-view",
    name,
    navigation,
    refs,
    updatedAt: input.timestamp,
  };
}

export function compareCrossRunAuditSavedViews(
  left: CrossRunAuditSavedView,
  right: CrossRunAuditSavedView,
): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

export function hasCrossRunAuditSavedViewState(
  navigation: Partial<CrossRunAuditNavigationFilters> = {},
  refs: CrossRunAuditSavedViewNavigationRefs = {},
): boolean {
  return (
    hasCrossRunAuditSummaryFilters(navigation.summary) ||
    hasCrossRunAuditDrilldownFilters(navigation.drilldown) ||
    Boolean(refs.auditViewRunId || refs.drilldownRunId)
  );
}

export function normalizeCrossRunAuditNavigationFilters(
  navigation: Partial<CrossRunAuditNavigationFilters> = {},
): CrossRunAuditNavigationFilters {
  return {
    drilldown: normalizeCrossRunAuditDrilldownFilters(navigation.drilldown),
    summary: normalizeCrossRunAuditSummaryFilters(navigation.summary),
  };
}

function normalizeCrossRunAuditSavedViewRefs(
  refs: CrossRunAuditSavedViewNavigationRefs | undefined,
): CrossRunAuditSavedViewNavigationRefs {
  const auditViewRunId = refs?.auditViewRunId?.trim();
  const drilldownRunId = refs?.drilldownRunId?.trim();

  return {
    ...(auditViewRunId ? { auditViewRunId } : {}),
    ...(drilldownRunId ? { drilldownRunId } : {}),
  };
}

function normalizeCrossRunAuditSummaryFilters(
  filters: CrossRunAuditQueryFilters | undefined,
): CrossRunAuditQueryFilters {
  const definitionId = filters?.definitionId?.trim();
  const toolName = filters?.toolName?.trim();

  return {
    ...(definitionId ? { definitionId } : {}),
    ...(filters?.executionMode ? { executionMode: filters.executionMode } : {}),
    ...(filters?.runStatus ? { runStatus: filters.runStatus } : {}),
    ...(toolName ? { toolName } : {}),
  };
}

function normalizeCrossRunAuditDrilldownFilters(
  filters: CrossRunAuditDrilldownFilters | undefined,
): CrossRunAuditDrilldownFilters {
  const approvalId = filters?.approvalId?.trim();
  const dispatchJobId = filters?.dispatchJobId?.trim();
  const runId = filters?.runId?.trim();
  const stepId = filters?.stepId?.trim();
  const toolCallId = filters?.toolCallId?.trim();
  const toolId = filters?.toolId?.trim();
  const workerId = filters?.workerId?.trim();

  return {
    ...(approvalId ? { approvalId } : {}),
    ...(dispatchJobId ? { dispatchJobId } : {}),
    ...(runId ? { runId } : {}),
    ...(stepId ? { stepId } : {}),
    ...(toolCallId ? { toolCallId } : {}),
    ...(toolId ? { toolId } : {}),
    ...(workerId ? { workerId } : {}),
  };
}

function hasCrossRunAuditSummaryFilters(
  filters: CrossRunAuditQueryFilters | undefined,
): boolean {
  return Boolean(
    filters?.definitionId ||
      filters?.executionMode ||
      filters?.runStatus ||
      filters?.toolName,
  );
}

function hasCrossRunAuditDrilldownFilters(
  filters: CrossRunAuditDrilldownFilters | undefined,
): boolean {
  return Boolean(
    filters?.approvalId ||
      filters?.dispatchJobId ||
      filters?.runId ||
      filters?.stepId ||
      filters?.toolCallId ||
      filters?.toolId ||
      filters?.workerId,
  );
}
