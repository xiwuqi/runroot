import cors from "@fastify/cors";
import { approvalsPackageBoundary } from "@runroot/approvals";
import { cliPackageBoundary } from "@runroot/cli";
import { projectMetadata, requiredQualityCommands } from "@runroot/config";
import { coreRuntimePackageBoundary } from "@runroot/core-runtime";
import { dispatchPackageBoundary } from "@runroot/dispatch";
import {
  domainPackageBoundary,
  type JsonValue,
  type RunStatus,
} from "@runroot/domain";
import { eventsPackageBoundary } from "@runroot/events";
import { mcpPackageBoundary } from "@runroot/mcp";
import { observabilityPackageBoundary } from "@runroot/observability";
import { persistencePackageBoundary } from "@runroot/persistence";
import { replayPackageBoundary } from "@runroot/replay";
import {
  createRunrootOperatorService,
  OperatorConflictError,
  OperatorError,
  OperatorInputError,
  OperatorNotFoundError,
  type RunrootOperatorService,
  sdkPackageBoundary,
} from "@runroot/sdk";
import { templatesPackageBoundary } from "@runroot/templates";
import { toolsPackageBoundary } from "@runroot/tools";
import Fastify from "fastify";

export const packageBoundaries = [
  domainPackageBoundary,
  coreRuntimePackageBoundary,
  dispatchPackageBoundary,
  persistencePackageBoundary,
  eventsPackageBoundary,
  toolsPackageBoundary,
  mcpPackageBoundary,
  approvalsPackageBoundary,
  replayPackageBoundary,
  observabilityPackageBoundary,
  sdkPackageBoundary,
  cliPackageBoundary,
  templatesPackageBoundary,
] as const;

function findDuplicateBoundaryNames(names: readonly string[]): string[] {
  const counts = new Map<string, number>();

  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort();
}

export interface BuildServerOptions {
  readonly operator?: RunrootOperatorService;
}

export function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });
  const operator =
    options.operator ??
    createRunrootOperatorService({
      ...(process.env.RUNROOT_WORKSPACE_PATH
        ? {
            workspacePath: process.env.RUNROOT_WORKSPACE_PATH,
          }
        : {}),
    });

  app.register(cors, {
    origin: true,
  });

  app.get("/healthz", async () => ({
    status: "ok",
    project: projectMetadata.name,
    phase: projectMetadata.currentPhase,
  }));

  app.get("/manifest/project", async () => ({
    project: projectMetadata,
    commands: requiredQualityCommands,
    workspacePath: operator.getWorkspacePath(),
  }));

  app.get("/manifest/packages", async () => ({
    packages: packageBoundaries,
    integrity: {
      duplicateNames: findDuplicateBoundaryNames(
        packageBoundaries.map((boundary) => boundary.name),
      ),
    },
  }));

  app.get("/templates", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      templates: operator.listTemplates(),
    })),
  );

  app.get("/runs", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      runs: await operator.listRuns(),
    })),
  );

  app.get("/audit/runs", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const query = request.query as {
        readonly definitionId?: string;
        readonly executionMode?: "inline" | "queued";
        readonly runStatus?: string;
        readonly toolName?: string;
      };
      const runStatus = readRunStatusQuery(query.runStatus);

      return {
        audit: await operator.listAuditResults({
          ...(query.definitionId ? { definitionId: query.definitionId } : {}),
          ...(query.executionMode
            ? { executionMode: query.executionMode }
            : {}),
          ...(runStatus ? { runStatus } : {}),
          ...(query.toolName ? { toolName: query.toolName } : {}),
        }),
      };
    }),
  );

  app.get("/audit/drilldowns", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const query = request.query as {
        readonly approvalId?: string;
        readonly dispatchJobId?: string;
        readonly runId?: string;
        readonly stepId?: string;
        readonly toolCallId?: string;
        readonly toolId?: string;
        readonly workerId?: string;
      };

      return {
        audit: await operator.listAuditDrilldowns({
          ...(query.approvalId ? { approvalId: query.approvalId } : {}),
          ...(query.dispatchJobId
            ? { dispatchJobId: query.dispatchJobId }
            : {}),
          ...(query.runId ? { runId: query.runId } : {}),
          ...(query.stepId ? { stepId: query.stepId } : {}),
          ...(query.toolCallId ? { toolCallId: query.toolCallId } : {}),
          ...(query.toolId ? { toolId: query.toolId } : {}),
          ...(query.workerId ? { workerId: query.workerId } : {}),
        }),
      };
    }),
  );

  app.get("/audit/navigation", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const query = request.query as {
        readonly approvalId?: string;
        readonly definitionId?: string;
        readonly dispatchJobId?: string;
        readonly executionMode?: "inline" | "queued";
        readonly runId?: string;
        readonly runStatus?: string;
        readonly stepId?: string;
        readonly toolCallId?: string;
        readonly toolId?: string;
        readonly toolName?: string;
        readonly workerId?: string;
      };
      const runStatus = readRunStatusQuery(query.runStatus);

      return {
        audit: await operator.getAuditNavigation({
          drilldown: {
            ...(query.approvalId ? { approvalId: query.approvalId } : {}),
            ...(query.dispatchJobId
              ? { dispatchJobId: query.dispatchJobId }
              : {}),
            ...(query.runId ? { runId: query.runId } : {}),
            ...(query.stepId ? { stepId: query.stepId } : {}),
            ...(query.toolCallId ? { toolCallId: query.toolCallId } : {}),
            ...(query.toolId ? { toolId: query.toolId } : {}),
            ...(query.workerId ? { workerId: query.workerId } : {}),
          },
          summary: {
            ...(query.definitionId ? { definitionId: query.definitionId } : {}),
            ...(query.executionMode
              ? { executionMode: query.executionMode }
              : {}),
            ...(runStatus ? { runStatus } : {}),
            ...(query.toolName ? { toolName: query.toolName } : {}),
          },
        }),
      };
    }),
  );

  app.get("/audit/saved-views", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      savedViews: await operator.listSavedViews(),
    })),
  );

  app.get("/audit/catalog", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      catalog: await operator.listCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/visible", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      visibility: await operator.listVisibleCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/reviewed", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      reviewed: await operator.listReviewedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/assigned", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      assigned: await operator.listAssignedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/checklisted", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      checklisted: await operator.listChecklistedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/progressed", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      progressed: await operator.listProgressedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/blocked", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      blocked: await operator.listBlockedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/resolved", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      resolved: await operator.listResolvedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/verified", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      verified: await operator.listVerifiedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/evidenced", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      evidenced: await operator.listEvidencedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/attested", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      attested: await operator.listAttestedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/acknowledged", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      acknowledged: await operator.listAcknowledgedCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/signed-off", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      signedOff: await operator.listSignedOffCatalogEntries(),
    })),
  );

  app.get("/audit/catalog/excepted", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      excepted: await operator.listExceptedCatalogEntries(),
    })),
  );

  app.post("/audit/saved-views", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const body = request.body as {
        readonly description?: string;
        readonly kind?: "operator-preset" | "saved-view";
        readonly name?: string;
        readonly navigation?: {
          readonly drilldown?: {
            readonly approvalId?: string;
            readonly dispatchJobId?: string;
            readonly runId?: string;
            readonly stepId?: string;
            readonly toolCallId?: string;
            readonly toolId?: string;
            readonly workerId?: string;
          };
          readonly summary?: {
            readonly definitionId?: string;
            readonly executionMode?: string;
            readonly runStatus?: string;
            readonly toolName?: string;
          };
        };
        readonly refs?: {
          readonly auditViewRunId?: string;
          readonly drilldownRunId?: string;
        };
      };

      if (!body?.name) {
        throw new OperatorInputError("name is required.");
      }

      const kind = body.kind ? readSavedViewKind(body.kind) : undefined;
      const navigation = body.navigation
        ? readSavedViewNavigation(body.navigation)
        : undefined;
      const refs = body.refs ? readSavedViewRefs(body.refs) : undefined;

      const savedView = await operator.saveSavedView({
        ...(body.description ? { description: body.description } : {}),
        ...(kind ? { kind } : {}),
        name: body.name,
        ...(navigation ? { navigation } : {}),
        ...(refs ? { refs } : {}),
      });

      reply.code(201);

      return {
        savedView,
      };
    }),
  );

  app.post("/audit/catalog", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const body = request.body as {
        readonly description?: string;
        readonly name?: string;
        readonly savedViewId?: string;
      };

      if (!body?.savedViewId) {
        throw new OperatorInputError("savedViewId is required.");
      }

      const catalogEntry = await operator.publishCatalogEntry({
        ...(body.description ? { description: body.description } : {}),
        ...(body.name ? { name: body.name } : {}),
        savedViewId: body.savedViewId,
      });

      reply.code(201);

      return {
        catalogEntry,
      };
    }),
  );

  app.get("/audit/saved-views/:savedViewId", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly savedViewId: string;
      };

      return {
        savedView: await operator.getSavedView(params.savedViewId),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/visibility", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        visibility: await operator.getCatalogVisibility(params.catalogEntryId),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/review", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        review: await operator.getCatalogReviewSignal(params.catalogEntryId),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/assignment", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        assignment: await operator.getCatalogReviewAssignment(
          params.catalogEntryId,
        ),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/checklist", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        checklist: await operator.getCatalogAssignmentChecklist(
          params.catalogEntryId,
        ),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/progress", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        progress: await operator.getCatalogChecklistItemProgress(
          params.catalogEntryId,
        ),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/blocker", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        blocker: await operator.getCatalogChecklistItemBlocker(
          params.catalogEntryId,
        ),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/resolution", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        resolution: await operator.getCatalogChecklistItemResolution(
          params.catalogEntryId,
        ),
      };
    }),
  );

  app.get(
    "/audit/catalog/:catalogEntryId/verification",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          verification: await operator.getCatalogChecklistItemVerification(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.get("/audit/catalog/:catalogEntryId/evidence", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        evidence: await operator.getCatalogChecklistItemEvidence(
          params.catalogEntryId,
        ),
      };
    }),
  );

  app.get(
    "/audit/catalog/:catalogEntryId/attestation",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          attestation: await operator.getCatalogChecklistItemAttestation(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.get(
    "/audit/catalog/:catalogEntryId/acknowledgment",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          acknowledgment: await operator.getCatalogChecklistItemAcknowledgment(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.get("/audit/catalog/:catalogEntryId/sign-off", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        signoff: await operator.getCatalogChecklistItemSignoff(
          params.catalogEntryId,
        ),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/exception", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        exception: await operator.getCatalogChecklistItemException(
          params.catalogEntryId,
        ),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        catalogEntry: await operator.getCatalogEntry(params.catalogEntryId),
      };
    }),
  );

  app.post("/audit/catalog/:catalogEntryId/share", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        visibility: await operator.shareCatalogEntry(params.catalogEntryId),
      };
    }),
  );

  app.post("/audit/catalog/:catalogEntryId/unshare", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        visibility: await operator.unshareCatalogEntry(params.catalogEntryId),
      };
    }),
  );

  app.post("/audit/catalog/:catalogEntryId/review", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };
      const body = request.body as {
        readonly note?: string;
        readonly state?: string;
      };

      if (!body?.state) {
        throw new OperatorInputError("state is required.");
      }

      return {
        review: await operator.reviewCatalogEntry(params.catalogEntryId, {
          ...(body.note !== undefined ? { note: body.note } : {}),
          state: readCatalogReviewState(body.state),
        }),
      };
    }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/assignment",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };
        const body = request.body as {
          readonly assigneeId?: string;
          readonly handoffNote?: string;
        };

        if (!body?.assigneeId) {
          throw new OperatorInputError("assigneeId is required.");
        }

        return {
          assignment: await operator.assignCatalogEntry(params.catalogEntryId, {
            ...(body.handoffNote !== undefined
              ? { handoffNote: body.handoffNote }
              : {}),
            assigneeId: body.assigneeId,
          }),
        };
      }),
  );

  app.post("/audit/catalog/:catalogEntryId/checklist", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };
      const body = request.body as {
        readonly items?: unknown;
        readonly state?: string;
      };

      if (!body?.state) {
        throw new OperatorInputError("state is required.");
      }

      const items =
        body.items === undefined
          ? undefined
          : readChecklistItems(body.items, "items");

      return {
        checklist: await operator.checklistCatalogEntry(params.catalogEntryId, {
          ...(items !== undefined ? { items } : {}),
          state: readCatalogChecklistState(body.state),
        }),
      };
    }),
  );

  app.post("/audit/catalog/:catalogEntryId/progress", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };
      const body = request.body as {
        readonly completionNote?: string;
        readonly items?: unknown;
      };
      const items = readChecklistItemProgressItems(body?.items, "items");

      if (items.length === 0) {
        throw new OperatorInputError(
          "items must include at least one checklist item progress entry.",
        );
      }

      return {
        progress: await operator.progressCatalogEntry(params.catalogEntryId, {
          ...(body?.completionNote !== undefined
            ? { completionNote: body.completionNote }
            : {}),
          items,
        }),
      };
    }),
  );

  app.post("/audit/catalog/:catalogEntryId/blocker", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };
      const body = request.body as {
        readonly blockerNote?: string;
        readonly items?: unknown;
      };
      const items = readChecklistItemBlockerItems(body?.items, "items");

      if (items.length === 0) {
        throw new OperatorInputError(
          "items must include at least one checklist item blocker entry.",
        );
      }

      return {
        blocker: await operator.blockCatalogEntry(params.catalogEntryId, {
          ...(body?.blockerNote !== undefined
            ? { blockerNote: body.blockerNote }
            : {}),
          items,
        }),
      };
    }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/resolution",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };
        const body = request.body as {
          readonly resolutionNote?: string;
          readonly items?: unknown;
        };
        const items = readChecklistItemResolutionItems(body?.items, "items");

        if (items.length === 0) {
          throw new OperatorInputError(
            "items must include at least one checklist item resolution entry.",
          );
        }

        return {
          resolution: await operator.resolveCatalogEntry(
            params.catalogEntryId,
            {
              ...(body?.resolutionNote !== undefined
                ? { resolutionNote: body.resolutionNote }
                : {}),
              items,
            },
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/verification",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };
        const body = request.body as {
          readonly verificationNote?: string;
          readonly items?: unknown;
        };
        const items = readChecklistItemVerificationItems(body?.items, "items");

        if (items.length === 0) {
          throw new OperatorInputError(
            "items must include at least one checklist item verification entry.",
          );
        }

        return {
          verification: await operator.verifyCatalogEntry(
            params.catalogEntryId,
            {
              ...(body?.verificationNote !== undefined
                ? { verificationNote: body.verificationNote }
                : {}),
              items,
            },
          ),
        };
      }),
  );

  app.post("/audit/catalog/:catalogEntryId/evidence", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };
      const body = request.body as {
        readonly evidenceNote?: string;
        readonly items?: unknown;
      };
      const items = readChecklistItemEvidenceItems(body?.items, "items");

      if (items.length === 0) {
        throw new OperatorInputError(
          "items must include at least one checklist item evidence entry.",
        );
      }

      return {
        evidence: await operator.recordCatalogEntryEvidence(
          params.catalogEntryId,
          {
            ...(body?.evidenceNote !== undefined
              ? { evidenceNote: body.evidenceNote }
              : {}),
            items,
          },
        ),
      };
    }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/attestation",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };
        const body = request.body as {
          readonly attestationNote?: string;
          readonly items?: unknown;
        };
        const items = readChecklistItemAttestationItems(body?.items, "items");

        if (items.length === 0) {
          throw new OperatorInputError(
            "items must include at least one checklist item attestation entry.",
          );
        }

        return {
          attestation: await operator.attestCatalogEntry(
            params.catalogEntryId,
            {
              ...(body?.attestationNote !== undefined
                ? { attestationNote: body.attestationNote }
                : {}),
              items,
            },
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/acknowledgment",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };
        const body = request.body as {
          readonly acknowledgmentNote?: string;
          readonly items?: unknown;
        };
        const items = readChecklistItemAcknowledgmentItems(
          body?.items,
          "items",
        );

        if (items.length === 0) {
          throw new OperatorInputError(
            "items must include at least one checklist item acknowledgment entry.",
          );
        }

        return {
          acknowledgment: await operator.acknowledgeCatalogEntry(
            params.catalogEntryId,
            {
              ...(body?.acknowledgmentNote !== undefined
                ? { acknowledgmentNote: body.acknowledgmentNote }
                : {}),
              items,
            },
          ),
        };
      }),
  );

  app.post("/audit/catalog/:catalogEntryId/sign-off", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };
      const body = request.body as {
        readonly signoffNote?: string;
        readonly items?: unknown;
      };
      const items = readChecklistItemSignoffItems(body?.items, "items");

      if (items.length === 0) {
        throw new OperatorInputError(
          "items must include at least one checklist item signoff entry.",
        );
      }

      return {
        signoff: await operator.signOffCatalogEntry(params.catalogEntryId, {
          ...(body?.signoffNote !== undefined
            ? { signoffNote: body.signoffNote }
            : {}),
          items,
        }),
      };
    }),
  );

  app.post("/audit/catalog/:catalogEntryId/exception", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };
      const body = request.body as {
        readonly exceptionNote?: string;
        readonly items?: unknown;
      };
      const items = readChecklistItemExceptionItems(body?.items, "items");

      if (items.length === 0) {
        throw new OperatorInputError(
          "items must include at least one checklist item exception entry.",
        );
      }

      return {
        exception: await operator.recordCatalogEntryException(
          params.catalogEntryId,
          {
            ...(body?.exceptionNote !== undefined
              ? { exceptionNote: body.exceptionNote }
              : {}),
            items,
          },
        ),
      };
    }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/review/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          review: await operator.clearCatalogReviewSignal(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/assignment/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          assignment: await operator.clearCatalogReviewAssignment(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/checklist/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          checklist: await operator.clearCatalogAssignmentChecklist(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/progress/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          progress: await operator.clearCatalogChecklistItemProgress(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/blocker/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          blocker: await operator.clearCatalogChecklistItemBlocker(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/resolution/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          resolution: await operator.clearCatalogChecklistItemResolution(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/verification/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          verification: await operator.clearCatalogChecklistItemVerification(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/evidence/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          evidence: await operator.clearCatalogChecklistItemEvidence(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/attestation/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          attestation: await operator.clearCatalogChecklistItemAttestation(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/acknowledgment/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          acknowledgment:
            await operator.clearCatalogChecklistItemAcknowledgment(
              params.catalogEntryId,
            ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/sign-off/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          signoff: await operator.clearCatalogChecklistItemSignoff(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.post(
    "/audit/catalog/:catalogEntryId/exception/clear",
    async (request, reply) =>
      handleOperatorResponse(reply, async () => {
        const params = request.params as {
          readonly catalogEntryId: string;
        };

        return {
          exception: await operator.clearCatalogChecklistItemException(
            params.catalogEntryId,
          ),
        };
      }),
  );

  app.get("/audit/saved-views/:savedViewId/apply", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly savedViewId: string;
      };

      return {
        application: await operator.applySavedView(params.savedViewId),
      };
    }),
  );

  app.post("/audit/catalog/:catalogEntryId/archive", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        catalogEntry: await operator.archiveCatalogEntry(params.catalogEntryId),
      };
    }),
  );

  app.get("/audit/catalog/:catalogEntryId/apply", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly catalogEntryId: string;
      };

      return {
        application: await operator.applyCatalogEntry(params.catalogEntryId),
      };
    }),
  );

  app.post("/runs", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const body = request.body as {
        readonly input?: unknown;
        readonly metadata?: Readonly<Record<string, string>>;
        readonly templateId?: string;
      };

      if (!body?.templateId) {
        throw new OperatorInputError("templateId is required.");
      }

      if (body.input === undefined) {
        throw new OperatorInputError("input is required.");
      }

      const run = await operator.startRun({
        input: body.input as JsonValue,
        ...(body.metadata ? { metadata: body.metadata } : {}),
        templateId: body.templateId,
      });

      reply.code(201);

      return {
        run,
      };
    }),
  );

  app.get("/runs/:runId", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        run: await operator.getRun(params.runId),
      };
    }),
  );

  app.get("/runs/:runId/approvals", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        approvals: await operator.getApprovals(params.runId),
      };
    }),
  );

  app.post("/runs/:runId/resume", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        run: await operator.resumeRun(params.runId),
      };
    }),
  );

  app.get("/runs/:runId/timeline", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        timeline: await operator.getTimeline(params.runId),
      };
    }),
  );

  app.get("/runs/:runId/audit", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        audit: await operator.getAuditView(params.runId),
      };
    }),
  );

  app.get("/runs/:runId/tool-history", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly runId: string;
      };

      return {
        entries: await operator.getToolHistory(params.runId),
      };
    }),
  );

  app.get("/approvals/pending", async (_request, reply) =>
    handleOperatorResponse(reply, async () => ({
      approvals: await operator.getPendingApprovals(),
    })),
  );

  app.get("/approvals/:approvalId", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly approvalId: string;
      };

      return {
        approval: await operator.getApproval(params.approvalId),
      };
    }),
  );

  app.post("/approvals/:approvalId/decision", async (request, reply) =>
    handleOperatorResponse(reply, async () => {
      const params = request.params as {
        readonly approvalId: string;
      };
      const body = request.body as {
        readonly actorDisplayName?: string;
        readonly actorId?: string;
        readonly decision?: "approved" | "cancelled" | "rejected";
        readonly note?: string;
      };

      if (!body?.decision) {
        throw new OperatorInputError("decision is required.");
      }

      const outcome = await operator.decideApproval(params.approvalId, {
        ...(body.actorId
          ? {
              actor: {
                ...(body.actorDisplayName
                  ? { displayName: body.actorDisplayName }
                  : {}),
                id: body.actorId,
              },
            }
          : {}),
        decision: body.decision,
        ...(body.note === undefined ? {} : { note: body.note }),
      });

      return outcome;
    }),
  );

  return app;
}

async function handleOperatorResponse<TValue>(
  reply: {
    code(statusCode: number): typeof reply;
  },
  task: () => Promise<TValue>,
): Promise<TValue> {
  try {
    return await task();
  } catch (error) {
    throw mapOperatorError(reply, error);
  }
}

function mapOperatorError(
  reply: {
    code(statusCode: number): typeof reply;
  },
  error: unknown,
): Error {
  if (error instanceof OperatorError) {
    reply.code(error.statusCode);

    return error;
  }

  if (
    error instanceof OperatorConflictError ||
    error instanceof OperatorInputError ||
    error instanceof OperatorNotFoundError
  ) {
    reply.code(error.statusCode);

    return error;
  }

  return error instanceof Error ? error : new Error(String(error));
}

function readRunStatusQuery(value: string | undefined): RunStatus | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "cancelled":
    case "failed":
    case "paused":
    case "pending":
    case "queued":
    case "running":
    case "succeeded":
      return value;
    default:
      throw new OperatorInputError(
        "runStatus must be one of cancelled|failed|paused|pending|queued|running|succeeded.",
      );
  }
}

function readExecutionModeValue(
  value: string | undefined,
  fieldName: string,
): "inline" | "queued" | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "inline":
    case "queued":
      return value;
    default:
      throw new OperatorInputError(
        `${fieldName} must be one of inline|queued.`,
      );
  }
}

function readSavedViewKind(
  value: string | undefined,
): "operator-preset" | "saved-view" | undefined {
  switch (value) {
    case undefined:
      return undefined;
    case "operator-preset":
    case "saved-view":
      return value;
    default:
      throw new OperatorInputError(
        "kind must be one of saved-view|operator-preset.",
      );
  }
}

function readSavedViewNavigation(input: {
  readonly drilldown?: {
    readonly approvalId?: string;
    readonly dispatchJobId?: string;
    readonly runId?: string;
    readonly stepId?: string;
    readonly toolCallId?: string;
    readonly toolId?: string;
    readonly workerId?: string;
  };
  readonly summary?: {
    readonly definitionId?: string;
    readonly executionMode?: string;
    readonly runStatus?: string;
    readonly toolName?: string;
  };
}) {
  const summary = input.summary ?? {};
  const drilldown = input.drilldown ?? {};
  const runStatus = readRunStatusQuery(summary.runStatus);
  const executionMode = readExecutionModeValue(
    summary.executionMode,
    "navigation.summary.executionMode",
  );

  return {
    drilldown: {
      ...(drilldown.approvalId ? { approvalId: drilldown.approvalId } : {}),
      ...(drilldown.dispatchJobId
        ? { dispatchJobId: drilldown.dispatchJobId }
        : {}),
      ...(drilldown.runId ? { runId: drilldown.runId } : {}),
      ...(drilldown.stepId ? { stepId: drilldown.stepId } : {}),
      ...(drilldown.toolCallId ? { toolCallId: drilldown.toolCallId } : {}),
      ...(drilldown.toolId ? { toolId: drilldown.toolId } : {}),
      ...(drilldown.workerId ? { workerId: drilldown.workerId } : {}),
    },
    summary: {
      ...(summary.definitionId ? { definitionId: summary.definitionId } : {}),
      ...(executionMode ? { executionMode } : {}),
      ...(runStatus ? { runStatus } : {}),
      ...(summary.toolName ? { toolName: summary.toolName } : {}),
    },
  };
}

function readSavedViewRefs(input: {
  readonly auditViewRunId?: string;
  readonly drilldownRunId?: string;
}) {
  return {
    ...(input.auditViewRunId ? { auditViewRunId: input.auditViewRunId } : {}),
    ...(input.drilldownRunId ? { drilldownRunId: input.drilldownRunId } : {}),
  };
}

function readCatalogReviewState(value: string): "recommended" | "reviewed" {
  switch (value) {
    case "recommended":
    case "reviewed":
      return value;
    default:
      throw new OperatorInputError(
        "state must be one of recommended|reviewed.",
      );
  }
}

function readCatalogChecklistState(value: string): "completed" | "pending" {
  switch (value) {
    case "completed":
    case "pending":
      return value;
    default:
      throw new OperatorInputError("state must be one of pending|completed.");
  }
}

function readChecklistItems(
  value: unknown,
  fieldName: string,
): readonly string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new OperatorInputError(`${fieldName} must be an array of strings.`);
  }

  return value;
}

function readChecklistItemProgressItems(
  value: unknown,
  fieldName: string,
): readonly {
  readonly item: string;
  readonly state: "completed" | "pending";
}[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "item" in entry &&
        typeof entry.item === "string" &&
        "state" in entry &&
        (entry.state === "completed" || entry.state === "pending"),
    )
  ) {
    throw new OperatorInputError(
      `${fieldName} must be an array of { item, state } objects with state pending|completed.`,
    );
  }

  return value;
}

function readChecklistItemBlockerItems(
  value: unknown,
  fieldName: string,
): readonly {
  readonly item: string;
  readonly state: "blocked" | "cleared";
}[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "item" in entry &&
        typeof entry.item === "string" &&
        "state" in entry &&
        (entry.state === "blocked" || entry.state === "cleared"),
    )
  ) {
    throw new OperatorInputError(
      `${fieldName} must be an array of { item, state } objects with state blocked|cleared.`,
    );
  }

  return value;
}

function readChecklistItemResolutionItems(
  value: unknown,
  fieldName: string,
): readonly {
  readonly item: string;
  readonly state: "resolved" | "unresolved";
}[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "item" in entry &&
        typeof entry.item === "string" &&
        "state" in entry &&
        (entry.state === "resolved" || entry.state === "unresolved"),
    )
  ) {
    throw new OperatorInputError(
      `${fieldName} must be an array of { item, state } objects with state resolved|unresolved.`,
    );
  }

  return value;
}

function readChecklistItemVerificationItems(
  value: unknown,
  fieldName: string,
): readonly {
  readonly item: string;
  readonly state: "verified" | "unverified";
}[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "item" in entry &&
        typeof entry.item === "string" &&
        "state" in entry &&
        (entry.state === "verified" || entry.state === "unverified"),
    )
  ) {
    throw new OperatorInputError(
      `${fieldName} must be an array of { item, state } objects with state verified|unverified.`,
    );
  }

  return value;
}

function readChecklistItemEvidenceItems(
  value: unknown,
  fieldName: string,
): readonly {
  readonly item: string;
  readonly references: readonly string[];
}[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "item" in entry &&
        typeof entry.item === "string" &&
        "references" in entry &&
        Array.isArray(entry.references) &&
        entry.references.every(
          (reference: unknown) => typeof reference === "string",
        ),
    )
  ) {
    throw new OperatorInputError(
      `${fieldName} must be an array of { item, references } objects with references as a string array.`,
    );
  }

  return value;
}

function readChecklistItemAttestationItems(
  value: unknown,
  fieldName: string,
): readonly {
  readonly item: string;
  readonly state: "attested" | "unattested";
}[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "item" in entry &&
        typeof entry.item === "string" &&
        "state" in entry &&
        (entry.state === "attested" || entry.state === "unattested"),
    )
  ) {
    throw new OperatorInputError(
      `${fieldName} must be an array of { item, state } objects with state attested|unattested.`,
    );
  }

  return value;
}

function readChecklistItemAcknowledgmentItems(
  value: unknown,
  fieldName: string,
): readonly {
  readonly item: string;
  readonly state: "acknowledged" | "unacknowledged";
}[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "item" in entry &&
        typeof entry.item === "string" &&
        "state" in entry &&
        (entry.state === "acknowledged" || entry.state === "unacknowledged"),
    )
  ) {
    throw new OperatorInputError(
      `${fieldName} must be an array of { item, state } objects with state acknowledged|unacknowledged.`,
    );
  }

  return value;
}

function readChecklistItemSignoffItems(
  value: unknown,
  fieldName: string,
): readonly {
  readonly item: string;
  readonly state: "signed-off" | "unsigned";
}[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "item" in entry &&
        typeof entry.item === "string" &&
        "state" in entry &&
        (entry.state === "signed-off" || entry.state === "unsigned"),
    )
  ) {
    throw new OperatorInputError(
      `${fieldName} must be an array of { item, state } objects with state signed-off|unsigned.`,
    );
  }

  return value;
}

function readChecklistItemExceptionItems(
  value: unknown,
  fieldName: string,
): readonly {
  readonly item: string;
  readonly state: "excepted" | "not-excepted";
}[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        "item" in entry &&
        typeof entry.item === "string" &&
        "state" in entry &&
        (entry.state === "excepted" || entry.state === "not-excepted"),
    )
  ) {
    throw new OperatorInputError(
      `${fieldName} must be an array of { item, state } objects with state excepted|not-excepted.`,
    );
  }

  return value;
}
