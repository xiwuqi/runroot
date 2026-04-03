#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import type { PackageBoundary } from "@runroot/config";
import type { JsonValue, RunStatus } from "@runroot/domain";
import {
  type AcknowledgeAuditCatalogEntryInput,
  type AttestAuditCatalogEntryInput,
  type BlockAuditCatalogEntryInput,
  type ChecklistAuditCatalogEntryInput,
  createRunrootOperatorService,
  type DecideApprovalInput,
  OperatorError,
  type ProgressAuditCatalogEntryInput,
  type PublishAuditViewCatalogEntryInput,
  type RecordAuditCatalogEntryEvidenceInput,
  type ResolveAuditCatalogEntryInput,
  resolveWorkspacePath,
  type SaveAuditSavedViewInput,
  type VerifyAuditCatalogEntryInput,
} from "@runroot/sdk";

export interface CliIo {
  readonly stderr: {
    write(message: string): void;
  };
  readonly stdout: {
    write(message: string): void;
  };
}

export interface RunCliOptions {
  readonly cwd?: string;
  readonly env?: Readonly<NodeJS.ProcessEnv>;
  readonly io?: CliIo;
}

export const cliPackageBoundary = {
  name: "@runroot/cli",
  kind: "package",
  phaseOwned: 5,
  responsibility:
    "Operator CLI entry points for runs, approvals, and templates.",
  publicSurface: ["command routing", "operator commands", "CLI helpers"],
} as const satisfies PackageBoundary;

export async function runCli(
  argv: readonly string[],
  options: RunCliOptions = {},
): Promise<number> {
  const io = options.io ?? createProcessIo();
  const { flags, positionals } = parseArgs(argv);

  if (positionals.length === 0 || positionals[0] === "help") {
    writeHelp(io.stdout.write);

    return 0;
  }

  const explicitWorkspacePath =
    getStringFlag(flags, "workspace") ?? options.env?.RUNROOT_WORKSPACE_PATH;
  const workspacePath = explicitWorkspacePath
    ? resolveWorkspacePath(explicitWorkspacePath, options.env)
    : undefined;
  const service = createRunrootOperatorService({
    ...(options.env ? { env: options.env } : {}),
    ...(workspacePath ? { workspacePath } : {}),
  });

  try {
    const [resource, action, subject, detail] = positionals;

    if (resource === "audit" && action === "saved-views") {
      switch (subject) {
        case "apply":
          if (!detail) {
            throw new Error(
              "audit saved-views apply requires a saved view id.",
            );
          }

          return writeJson(io.stdout.write, {
            application: await service.applySavedView(detail),
          });
        case "list":
          return writeJson(io.stdout.write, {
            savedViews: await service.listSavedViews(),
          });
        case "save":
          return writeJson(io.stdout.write, {
            savedView: await service.saveSavedView(
              resolveSaveSavedViewInput(flags),
            ),
          });
        case "show":
          if (!detail) {
            throw new Error("audit saved-views show requires a saved view id.");
          }

          return writeJson(io.stdout.write, {
            savedView: await service.getSavedView(detail),
          });
        default:
          throw new Error(
            `Unknown command "${positionals.join(" ")}". Run "help" to see supported commands.`,
          );
      }
    }

    if (resource === "audit" && action === "catalog") {
      switch (subject) {
        case "apply":
          if (!detail) {
            throw new Error("audit catalog apply requires a catalog entry id.");
          }

          return writeJson(io.stdout.write, {
            application: await service.applyCatalogEntry(detail),
          });
        case "archive":
          if (!detail) {
            throw new Error(
              "audit catalog archive requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            catalogEntry: await service.archiveCatalogEntry(detail),
          });
        case "assign":
          if (!detail) {
            throw new Error(
              "audit catalog assign requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            assignment: await service.assignCatalogEntry(
              detail,
              resolveAssignAuditCatalogEntryInput(flags),
            ),
          });
        case "block":
          if (!detail) {
            throw new Error("audit catalog block requires a catalog entry id.");
          }

          return writeJson(io.stdout.write, {
            blocker: await service.blockCatalogEntry(
              detail,
              resolveBlockAuditCatalogEntryInput(flags),
            ),
          });
        case "resolve":
          if (!detail) {
            throw new Error(
              "audit catalog resolve requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            resolution: await service.resolveCatalogEntry(
              detail,
              resolveResolveAuditCatalogEntryInput(flags),
            ),
          });
        case "verify":
          if (!detail) {
            throw new Error(
              "audit catalog verify requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            verification: await service.verifyCatalogEntry(
              detail,
              resolveVerifyAuditCatalogEntryInput(flags),
            ),
          });
        case "attest":
          if (!detail) {
            throw new Error(
              "audit catalog attest requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            attestation: await service.attestCatalogEntry(
              detail,
              resolveAttestAuditCatalogEntryInput(flags),
            ),
          });
        case "acknowledge":
          if (!detail) {
            throw new Error(
              "audit catalog acknowledge requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            acknowledgment: await service.acknowledgeCatalogEntry(
              detail,
              resolveAcknowledgeAuditCatalogEntryInput(flags),
            ),
          });
        case "record-evidence":
          if (!detail) {
            throw new Error(
              "audit catalog record-evidence requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            evidence: await service.recordCatalogEntryEvidence(
              detail,
              resolveRecordAuditCatalogEntryEvidenceInput(flags),
            ),
          });
        case "assigned":
          return writeJson(io.stdout.write, {
            assigned: await service.listAssignedCatalogEntries(),
          });
        case "blocked":
          return writeJson(io.stdout.write, {
            blocked: await service.listBlockedCatalogEntries(),
          });
        case "resolved":
          return writeJson(io.stdout.write, {
            resolved: await service.listResolvedCatalogEntries(),
          });
        case "verified":
          return writeJson(io.stdout.write, {
            verified: await service.listVerifiedCatalogEntries(),
          });
        case "evidenced":
          return writeJson(io.stdout.write, {
            evidenced: await service.listEvidencedCatalogEntries(),
          });
        case "attested":
          return writeJson(io.stdout.write, {
            attested: await service.listAttestedCatalogEntries(),
          });
        case "acknowledged":
          return writeJson(io.stdout.write, {
            acknowledged: await service.listAcknowledgedCatalogEntries(),
          });
        case "checklist":
          if (!detail) {
            throw new Error(
              "audit catalog checklist requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            checklist: await service.checklistCatalogEntry(
              detail,
              resolveChecklistAuditCatalogEntryInput(flags),
            ),
          });
        case "checklisted":
          return writeJson(io.stdout.write, {
            checklisted: await service.listChecklistedCatalogEntries(),
          });
        case "clear-progress":
          if (!detail) {
            throw new Error(
              "audit catalog clear-progress requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            progress: await service.clearCatalogChecklistItemProgress(detail),
          });
        case "clear-blocker":
          if (!detail) {
            throw new Error(
              "audit catalog clear-blocker requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            blocker: await service.clearCatalogChecklistItemBlocker(detail),
          });
        case "clear-resolution":
          if (!detail) {
            throw new Error(
              "audit catalog clear-resolution requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            resolution:
              await service.clearCatalogChecklistItemResolution(detail),
          });
        case "clear-verification":
          if (!detail) {
            throw new Error(
              "audit catalog clear-verification requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            verification:
              await service.clearCatalogChecklistItemVerification(detail),
          });
        case "clear-evidence":
          if (!detail) {
            throw new Error(
              "audit catalog clear-evidence requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            evidence: await service.clearCatalogChecklistItemEvidence(detail),
          });
        case "clear-attestation":
          if (!detail) {
            throw new Error(
              "audit catalog clear-attestation requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            attestation:
              await service.clearCatalogChecklistItemAttestation(detail),
          });
        case "clear-acknowledgment":
          if (!detail) {
            throw new Error(
              "audit catalog clear-acknowledgment requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            acknowledgment:
              await service.clearCatalogChecklistItemAcknowledgment(detail),
          });
        case "clear-assignment":
          if (!detail) {
            throw new Error(
              "audit catalog clear-assignment requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            assignment: await service.clearCatalogReviewAssignment(detail),
          });
        case "clear-checklist":
          if (!detail) {
            throw new Error(
              "audit catalog clear-checklist requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            checklist: await service.clearCatalogAssignmentChecklist(detail),
          });
        case "clear-review":
          if (!detail) {
            throw new Error(
              "audit catalog clear-review requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            review: await service.clearCatalogReviewSignal(detail),
          });
        case "inspect":
          if (!detail) {
            throw new Error(
              "audit catalog inspect requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            visibility: await service.getCatalogVisibility(detail),
          });
        case "inspect-assignment":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-assignment requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            assignment: await service.getCatalogReviewAssignment(detail),
          });
        case "inspect-checklist":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-checklist requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            checklist: await service.getCatalogAssignmentChecklist(detail),
          });
        case "inspect-progress":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-progress requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            progress: await service.getCatalogChecklistItemProgress(detail),
          });
        case "inspect-blocker":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-blocker requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            blocker: await service.getCatalogChecklistItemBlocker(detail),
          });
        case "inspect-resolution":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-resolution requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            resolution: await service.getCatalogChecklistItemResolution(detail),
          });
        case "inspect-verification":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-verification requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            verification:
              await service.getCatalogChecklistItemVerification(detail),
          });
        case "inspect-evidence":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-evidence requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            evidence: await service.getCatalogChecklistItemEvidence(detail),
          });
        case "inspect-attestation":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-attestation requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            attestation:
              await service.getCatalogChecklistItemAttestation(detail),
          });
        case "inspect-acknowledgment":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-acknowledgment requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            acknowledgment:
              await service.getCatalogChecklistItemAcknowledgment(detail),
          });
        case "inspect-review":
          if (!detail) {
            throw new Error(
              "audit catalog inspect-review requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            review: await service.getCatalogReviewSignal(detail),
          });
        case "list":
          return writeJson(io.stdout.write, {
            catalog: await service.listCatalogEntries(),
          });
        case "progress":
          if (!detail) {
            throw new Error(
              "audit catalog progress requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            progress: await service.progressCatalogEntry(
              detail,
              resolveProgressAuditCatalogEntryInput(flags),
            ),
          });
        case "progressed":
          return writeJson(io.stdout.write, {
            progressed: await service.listProgressedCatalogEntries(),
          });
        case "publish":
          return writeJson(io.stdout.write, {
            catalogEntry: await service.publishCatalogEntry(
              resolvePublishAuditCatalogEntryInput(flags, detail),
            ),
          });
        case "review":
          if (!detail) {
            throw new Error(
              "audit catalog review requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            review: await service.reviewCatalogEntry(
              detail,
              resolveReviewAuditCatalogEntryInput(flags),
            ),
          });
        case "share":
          if (!detail) {
            throw new Error("audit catalog share requires a catalog entry id.");
          }

          return writeJson(io.stdout.write, {
            visibility: await service.shareCatalogEntry(detail),
          });
        case "show":
          if (!detail) {
            throw new Error("audit catalog show requires a catalog entry id.");
          }

          return writeJson(io.stdout.write, {
            catalogEntry: await service.getCatalogEntry(detail),
          });
        case "unshare":
          if (!detail) {
            throw new Error(
              "audit catalog unshare requires a catalog entry id.",
            );
          }

          return writeJson(io.stdout.write, {
            visibility: await service.unshareCatalogEntry(detail),
          });
        case "visible":
          return writeJson(io.stdout.write, {
            visibility: await service.listVisibleCatalogEntries(),
          });
        case "reviewed":
          return writeJson(io.stdout.write, {
            reviewed: await service.listReviewedCatalogEntries(),
          });
        default:
          throw new Error(
            `Unknown command "${positionals.join(" ")}". Run "help" to see supported commands.`,
          );
      }
    }

    switch (`${resource}:${action ?? ""}`) {
      case "templates:list":
        return writeJson(io.stdout.write, {
          templates: service.listTemplates(),
          workspacePath: service.getWorkspacePath(),
        });
      case "runs:start":
        if (!subject) {
          throw new Error("runs start requires a template id.");
        }

        return writeJson(io.stdout.write, {
          run: await service.startRun({
            input: await resolveCommandInput(flags),
            templateId: subject,
          }),
          workspacePath: service.getWorkspacePath(),
        });
      case "runs:show":
        if (!subject) {
          throw new Error("runs show requires a run id.");
        }

        return writeJson(io.stdout.write, {
          run: await service.getRun(subject),
        });
      case "runs:resume":
        if (!subject) {
          throw new Error("runs resume requires a run id.");
        }

        return writeJson(io.stdout.write, {
          run: await service.resumeRun(subject),
        });
      case "runs:timeline":
        if (!subject) {
          throw new Error("runs timeline requires a run id.");
        }

        return writeJson(io.stdout.write, {
          timeline: await service.getTimeline(subject),
        });
      case "runs:audit":
        if (!subject) {
          throw new Error("runs audit requires a run id.");
        }

        return writeJson(io.stdout.write, {
          audit: await service.getAuditView(subject),
        });
      case "audit:list":
        return writeJson(io.stdout.write, {
          audit: await service.listAuditResults(
            resolveCrossRunAuditFilters(flags),
          ),
        });
      case "audit:drilldown":
        return writeJson(io.stdout.write, {
          audit: await service.listAuditDrilldowns(
            resolveCrossRunAuditDrilldownFilters(flags),
          ),
        });
      case "audit:navigate":
        return writeJson(io.stdout.write, {
          audit: await service.getAuditNavigation({
            drilldown: resolveCrossRunAuditDrilldownFilters(flags),
            summary: resolveCrossRunAuditFilters(flags),
          }),
        });
      case "approvals:pending":
        return writeJson(io.stdout.write, {
          approvals: await service.getPendingApprovals(),
        });
      case "approvals:show":
        if (!subject) {
          throw new Error("approvals show requires an approval id.");
        }

        return writeJson(io.stdout.write, {
          approval: await service.getApproval(subject),
        });
      case "approvals:decide":
        if (!subject) {
          throw new Error("approvals decide requires an approval id.");
        }

        return writeJson(
          io.stdout.write,
          await service.decideApproval(
            subject,
            createApprovalDecisionInput(flags),
          ),
        );
      default:
        throw new Error(
          `Unknown command "${positionals.join(" ")}". Run "help" to see supported commands.`,
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof OperatorError ? error.code : "cli_error";

    io.stderr.write(`${JSON.stringify({ code, error: message }, null, 2)}\n`);

    return error instanceof OperatorError ? 1 : 2;
  }
}

function createProcessIo(): CliIo {
  return {
    stderr: {
      write(message) {
        process.stderr.write(message);
      },
    },
    stdout: {
      write(message) {
        process.stdout.write(message);
      },
    },
  };
}

function parseArgs(argv: readonly string[]) {
  const flags = new Map<string, string | boolean>();
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token?.startsWith("--")) {
      positionals.push(token ?? "");
      continue;
    }

    const flagName = token.slice(2);
    const nextToken = argv[index + 1];

    if (!nextToken || nextToken.startsWith("--")) {
      flags.set(flagName, true);
      continue;
    }

    flags.set(flagName, nextToken);
    index += 1;
  }

  return {
    flags,
    positionals,
  };
}

async function resolveCommandInput(
  flags: ReadonlyMap<string, string | boolean>,
): Promise<JsonValue> {
  const inputJson = getStringFlag(flags, "input-json");
  const inputFile = getStringFlag(flags, "input-file");

  if (inputJson && inputFile) {
    throw new Error("Use either --input-json or --input-file, not both.");
  }

  if (inputJson) {
    return JSON.parse(inputJson) as JsonValue;
  }

  if (inputFile) {
    const rawInput = await readFile(inputFile, "utf8");

    return JSON.parse(rawInput) as JsonValue;
  }

  throw new Error("Provide workflow input with --input-json or --input-file.");
}

function resolveDecision(
  flags: ReadonlyMap<string, string | boolean>,
): DecideApprovalInput["decision"] {
  const decision = getStringFlag(flags, "decision");

  if (
    decision === "approved" ||
    decision === "cancelled" ||
    decision === "rejected"
  ) {
    return decision;
  }

  throw new Error(
    "approvals decide requires --decision approved|rejected|cancelled.",
  );
}

function createApprovalDecisionInput(
  flags: ReadonlyMap<string, string | boolean>,
): DecideApprovalInput {
  const actorId = getStringFlag(flags, "actor");
  const actorDisplayName = getStringFlag(flags, "actor-display");
  const note = getStringFlag(flags, "note");

  return {
    ...(actorId
      ? {
          actor: {
            id: actorId,
            ...(actorDisplayName ? { displayName: actorDisplayName } : {}),
          },
        }
      : {}),
    decision: resolveDecision(flags),
    ...(note ? { note } : {}),
  };
}

function resolveSaveSavedViewInput(
  flags: ReadonlyMap<string, string | boolean>,
): SaveAuditSavedViewInput {
  const name = getStringFlag(flags, "name");

  if (!name) {
    throw new Error("audit saved-views save requires --name.");
  }

  const description = getStringFlag(flags, "description");
  const auditViewRunId = getStringFlag(flags, "audit-view-run-id");
  const drilldownRunId = getStringFlag(flags, "drilldown-run-id");
  const preset = flags.get("preset") === true;

  return {
    ...(description ? { description } : {}),
    ...(preset ? { kind: "operator-preset" as const } : {}),
    name,
    navigation: {
      drilldown: resolveCrossRunAuditDrilldownFilters(flags),
      summary: resolveCrossRunAuditFilters(flags),
    },
    refs: {
      ...(auditViewRunId ? { auditViewRunId } : {}),
      ...(drilldownRunId ? { drilldownRunId } : {}),
    },
  };
}

function resolvePublishAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
  savedViewIdFromPosition?: string,
): PublishAuditViewCatalogEntryInput {
  const savedViewId =
    savedViewIdFromPosition ?? getStringFlag(flags, "saved-view-id");

  if (!savedViewId) {
    throw new Error(
      "audit catalog publish requires a saved view id as a positional argument or --saved-view-id.",
    );
  }

  const description = getStringFlag(flags, "description");
  const name = getStringFlag(flags, "name");

  return {
    ...(description ? { description } : {}),
    ...(name ? { name } : {}),
    savedViewId,
  };
}

function resolveReviewAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
): {
  readonly note?: string;
  readonly state: "recommended" | "reviewed";
} {
  const state = getStringFlag(flags, "state");
  const note = getStringFlag(flags, "note");

  if (state !== "recommended" && state !== "reviewed") {
    throw new Error(
      "audit catalog review requires --state recommended|reviewed.",
    );
  }

  return {
    ...(note !== undefined ? { note } : {}),
    state,
  };
}

function resolveAssignAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
): {
  readonly assigneeId: string;
  readonly handoffNote?: string;
} {
  const assigneeId = getStringFlag(flags, "assignee");
  const handoffNote = getStringFlag(flags, "handoff-note");

  if (!assigneeId) {
    throw new Error("audit catalog assign requires --assignee <operator-id>.");
  }

  return {
    assigneeId,
    ...(handoffNote !== undefined ? { handoffNote } : {}),
  };
}

function resolveChecklistAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
): ChecklistAuditCatalogEntryInput {
  const state = getStringFlag(flags, "status");
  const itemsJson = getStringFlag(flags, "items-json");

  if (state !== "pending" && state !== "completed") {
    throw new Error(
      "audit catalog checklist requires --status pending|completed.",
    );
  }

  return {
    ...(itemsJson !== undefined
      ? { items: resolveChecklistItems(itemsJson) }
      : {}),
    state,
  };
}

function resolveProgressAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
): ProgressAuditCatalogEntryInput {
  const itemsJson = getStringFlag(flags, "items-json");
  const completionNote = getStringFlag(flags, "completion-note");

  if (!itemsJson) {
    throw new Error(
      "audit catalog progress requires --items-json <json-array>.",
    );
  }

  return {
    ...(completionNote !== undefined ? { completionNote } : {}),
    items: resolveChecklistItemProgressItems(itemsJson),
  };
}

function resolveBlockAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
): BlockAuditCatalogEntryInput {
  const itemsJson = getStringFlag(flags, "items-json");
  const blockerNote = getStringFlag(flags, "blocker-note");

  if (!itemsJson) {
    throw new Error("audit catalog block requires --items-json <json-array>.");
  }

  return {
    ...(blockerNote !== undefined ? { blockerNote } : {}),
    items: resolveChecklistItemBlockerItems(itemsJson),
  };
}

function resolveResolveAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
): ResolveAuditCatalogEntryInput {
  const itemsJson = getStringFlag(flags, "items-json");
  const resolutionNote = getStringFlag(flags, "resolution-note");

  if (!itemsJson) {
    throw new Error(
      "audit catalog resolve requires --items-json <json-array>.",
    );
  }

  return {
    ...(resolutionNote !== undefined ? { resolutionNote } : {}),
    items: resolveChecklistItemResolutionItems(itemsJson),
  };
}

function resolveVerifyAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
): VerifyAuditCatalogEntryInput {
  const itemsJson = getStringFlag(flags, "items-json");
  const verificationNote = getStringFlag(flags, "verification-note");

  if (!itemsJson) {
    throw new Error("audit catalog verify requires --items-json <json-array>.");
  }

  return {
    ...(verificationNote !== undefined ? { verificationNote } : {}),
    items: resolveChecklistItemVerificationItems(itemsJson),
  };
}

function resolveAttestAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
): AttestAuditCatalogEntryInput {
  const itemsJson = getStringFlag(flags, "items-json");
  const attestationNote = getStringFlag(flags, "attestation-note");

  if (!itemsJson) {
    throw new Error("audit catalog attest requires --items-json <json-array>.");
  }

  return {
    ...(attestationNote !== undefined ? { attestationNote } : {}),
    items: resolveChecklistItemAttestationItems(itemsJson),
  };
}

function resolveAcknowledgeAuditCatalogEntryInput(
  flags: ReadonlyMap<string, string | boolean>,
): AcknowledgeAuditCatalogEntryInput {
  const itemsJson = getStringFlag(flags, "items-json");
  const acknowledgmentNote = getStringFlag(flags, "acknowledgment-note");

  if (!itemsJson) {
    throw new Error(
      "audit catalog acknowledge requires --items-json <json-array>.",
    );
  }

  return {
    ...(acknowledgmentNote !== undefined ? { acknowledgmentNote } : {}),
    items: resolveChecklistItemAcknowledgmentItems(itemsJson),
  };
}

function resolveRecordAuditCatalogEntryEvidenceInput(
  flags: ReadonlyMap<string, string | boolean>,
): RecordAuditCatalogEntryEvidenceInput {
  const itemsJson = getStringFlag(flags, "items-json");
  const evidenceNote = getStringFlag(flags, "evidence-note");

  if (!itemsJson) {
    throw new Error(
      "audit catalog record-evidence requires --items-json <json-array>.",
    );
  }

  return {
    ...(evidenceNote !== undefined ? { evidenceNote } : {}),
    items: resolveChecklistItemEvidenceItems(itemsJson),
  };
}

function resolveChecklistItems(itemsJson: string): readonly string[] {
  const parsedItems = JSON.parse(itemsJson) as unknown;

  if (
    !Array.isArray(parsedItems) ||
    !parsedItems.every((item) => typeof item === "string")
  ) {
    throw new Error("--items-json must decode to an array of strings.");
  }

  return parsedItems;
}

function resolveChecklistItemProgressItems(itemsJson: string): readonly {
  readonly item: string;
  readonly state: "completed" | "pending";
}[] {
  const parsedItems = JSON.parse(itemsJson) as unknown;

  if (
    !Array.isArray(parsedItems) ||
    !parsedItems.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "item" in item &&
        typeof item.item === "string" &&
        "state" in item &&
        (item.state === "completed" || item.state === "pending"),
    )
  ) {
    throw new Error(
      "--items-json must decode to an array of { item, state } objects with state pending|completed.",
    );
  }

  return parsedItems;
}

function resolveChecklistItemBlockerItems(itemsJson: string): readonly {
  readonly item: string;
  readonly state: "blocked" | "cleared";
}[] {
  const parsedItems = JSON.parse(itemsJson) as unknown;

  if (
    !Array.isArray(parsedItems) ||
    !parsedItems.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "item" in item &&
        typeof item.item === "string" &&
        "state" in item &&
        (item.state === "blocked" || item.state === "cleared"),
    )
  ) {
    throw new Error(
      "--items-json must decode to an array of { item, state } objects with state blocked|cleared.",
    );
  }

  return parsedItems;
}

function resolveChecklistItemResolutionItems(itemsJson: string): readonly {
  readonly item: string;
  readonly state: "resolved" | "unresolved";
}[] {
  const parsedItems = JSON.parse(itemsJson) as unknown;

  if (
    !Array.isArray(parsedItems) ||
    !parsedItems.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "item" in item &&
        typeof item.item === "string" &&
        "state" in item &&
        (item.state === "resolved" || item.state === "unresolved"),
    )
  ) {
    throw new Error(
      "--items-json must decode to an array of { item, state } objects with state resolved|unresolved.",
    );
  }

  return parsedItems;
}

function resolveChecklistItemVerificationItems(itemsJson: string): readonly {
  readonly item: string;
  readonly state: "verified" | "unverified";
}[] {
  const parsedItems = JSON.parse(itemsJson) as unknown;

  if (
    !Array.isArray(parsedItems) ||
    !parsedItems.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "item" in item &&
        typeof item.item === "string" &&
        "state" in item &&
        (item.state === "verified" || item.state === "unverified"),
    )
  ) {
    throw new Error(
      "--items-json must decode to an array of { item, state } objects with state verified|unverified.",
    );
  }

  return parsedItems;
}

function resolveChecklistItemEvidenceItems(itemsJson: string): readonly {
  readonly item: string;
  readonly references: readonly string[];
}[] {
  const parsedItems = JSON.parse(itemsJson) as unknown;

  if (
    !Array.isArray(parsedItems) ||
    !parsedItems.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "item" in item &&
        typeof item.item === "string" &&
        "references" in item &&
        Array.isArray(item.references) &&
        item.references.every(
          (reference: unknown) => typeof reference === "string",
        ),
    )
  ) {
    throw new Error(
      "--items-json must decode to an array of { item, references } objects with references as a string array.",
    );
  }

  return parsedItems;
}

function resolveChecklistItemAttestationItems(itemsJson: string): readonly {
  readonly item: string;
  readonly state: "attested" | "unattested";
}[] {
  const parsedItems = JSON.parse(itemsJson) as unknown;

  if (
    !Array.isArray(parsedItems) ||
    !parsedItems.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "item" in item &&
        typeof item.item === "string" &&
        "state" in item &&
        (item.state === "attested" || item.state === "unattested"),
    )
  ) {
    throw new Error(
      "--items-json must decode to an array of { item, state } objects with state attested|unattested.",
    );
  }

  return parsedItems;
}

function resolveChecklistItemAcknowledgmentItems(itemsJson: string): readonly {
  readonly item: string;
  readonly state: "acknowledged" | "unacknowledged";
}[] {
  const parsedItems = JSON.parse(itemsJson) as unknown;

  if (
    !Array.isArray(parsedItems) ||
    !parsedItems.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "item" in item &&
        typeof item.item === "string" &&
        "state" in item &&
        (item.state === "acknowledged" || item.state === "unacknowledged"),
    )
  ) {
    throw new Error(
      "--items-json must decode to an array of { item, state } objects with state acknowledged|unacknowledged.",
    );
  }

  return parsedItems;
}

function getStringFlag(
  flags: ReadonlyMap<string, string | boolean>,
  name: string,
): string | undefined {
  const value = flags.get(name);

  return typeof value === "string" ? value : undefined;
}

function resolveCrossRunAuditFilters(
  flags: ReadonlyMap<string, string | boolean>,
) {
  const definitionId = getStringFlag(flags, "definition-id");
  const executionMode = resolveExecutionModeFlag(flags);
  const runStatus = resolveRunStatusFlag(flags);
  const toolName = getStringFlag(flags, "tool-name");

  return {
    ...(definitionId ? { definitionId } : {}),
    ...(executionMode ? { executionMode } : {}),
    ...(runStatus ? { runStatus } : {}),
    ...(toolName ? { toolName } : {}),
  };
}

function resolveCrossRunAuditDrilldownFilters(
  flags: ReadonlyMap<string, string | boolean>,
) {
  const approvalId = getStringFlag(flags, "approval-id");
  const dispatchJobId = getStringFlag(flags, "dispatch-job-id");
  const runId = getStringFlag(flags, "run-id");
  const stepId = getStringFlag(flags, "step-id");
  const toolCallId = getStringFlag(flags, "tool-call-id");
  const toolId = getStringFlag(flags, "tool-id");
  const workerId = getStringFlag(flags, "worker-id");

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

function resolveExecutionModeFlag(
  flags: ReadonlyMap<string, string | boolean>,
): "inline" | "queued" | undefined {
  const executionMode = getStringFlag(flags, "execution-mode");

  if (
    executionMode === undefined ||
    executionMode === "inline" ||
    executionMode === "queued"
  ) {
    return executionMode;
  }

  throw new Error("--execution-mode only supports inline|queued.");
}

function resolveRunStatusFlag(
  flags: ReadonlyMap<string, string | boolean>,
): RunStatus | undefined {
  const status = getStringFlag(flags, "status");

  if (status === undefined) {
    return undefined;
  }

  if (
    status === "cancelled" ||
    status === "failed" ||
    status === "paused" ||
    status === "pending" ||
    status === "queued" ||
    status === "running" ||
    status === "succeeded"
  ) {
    return status;
  }

  throw new Error(
    "--status only supports cancelled|failed|paused|pending|queued|running|succeeded.",
  );
}

function writeHelp(write: (message: string) => void): void {
  write(`Runroot CLI

Commands:
  templates list
  runs start <template-id> --input-file <path> | --input-json <json>
  runs show <run-id>
  runs resume <run-id>
  runs timeline <run-id>
  runs audit <run-id>
  audit list [--definition-id <id>] [--status <status>] [--execution-mode <inline|queued>] [--tool-name <name>]
  audit drilldown [--run-id <id>] [--approval-id <id>] [--step-id <id>] [--dispatch-job-id <id>] [--worker-id <id>] [--tool-call-id <id>] [--tool-id <id>]
  audit navigate [--definition-id <id>] [--status <status>] [--execution-mode <inline|queued>] [--tool-name <name>] [--run-id <id>] [--approval-id <id>] [--step-id <id>] [--dispatch-job-id <id>] [--worker-id <id>] [--tool-call-id <id>] [--tool-id <id>]
  audit catalog list
  audit catalog visible
  audit catalog reviewed
  audit catalog assigned
  audit catalog blocked
  audit catalog resolved
  audit catalog verified
  audit catalog evidenced
  audit catalog attested
  audit catalog acknowledged
  audit catalog checklisted
  audit catalog progressed
  audit catalog publish <saved-view-id> [--name <name>] [--description <text>]
  audit catalog show <catalog-entry-id>
  audit catalog inspect <catalog-entry-id>
  audit catalog inspect-assignment <catalog-entry-id>
  audit catalog inspect-blocker <catalog-entry-id>
  audit catalog inspect-resolution <catalog-entry-id>
  audit catalog inspect-verification <catalog-entry-id>
  audit catalog inspect-evidence <catalog-entry-id>
  audit catalog inspect-attestation <catalog-entry-id>
  audit catalog inspect-acknowledgment <catalog-entry-id>
  audit catalog inspect-checklist <catalog-entry-id>
  audit catalog inspect-progress <catalog-entry-id>
  audit catalog inspect-review <catalog-entry-id>
  audit catalog assign <catalog-entry-id> --assignee <operator-id> [--handoff-note <text>]
  audit catalog block <catalog-entry-id> --items-json <json-array> [--blocker-note <text>]
  audit catalog resolve <catalog-entry-id> --items-json <json-array> [--resolution-note <text>]
  audit catalog verify <catalog-entry-id> --items-json <json-array> [--verification-note <text>]
  audit catalog record-evidence <catalog-entry-id> --items-json <json-array> [--evidence-note <text>]
  audit catalog attest <catalog-entry-id> --items-json <json-array> [--attestation-note <text>]
  audit catalog acknowledge <catalog-entry-id> --items-json <json-array> [--acknowledgment-note <text>]
  audit catalog checklist <catalog-entry-id> --status <pending|completed> [--items-json <json-array>]
  audit catalog progress <catalog-entry-id> --items-json <json-array> [--completion-note <text>]
  audit catalog clear-blocker <catalog-entry-id>
  audit catalog clear-resolution <catalog-entry-id>
  audit catalog clear-verification <catalog-entry-id>
  audit catalog clear-evidence <catalog-entry-id>
  audit catalog clear-attestation <catalog-entry-id>
  audit catalog clear-acknowledgment <catalog-entry-id>
  audit catalog clear-assignment <catalog-entry-id>
  audit catalog clear-checklist <catalog-entry-id>
  audit catalog clear-progress <catalog-entry-id>
  audit catalog review <catalog-entry-id> --state <recommended|reviewed> [--note <text>]
  audit catalog clear-review <catalog-entry-id>
  audit catalog share <catalog-entry-id>
  audit catalog unshare <catalog-entry-id>
  audit catalog archive <catalog-entry-id>
  audit catalog apply <catalog-entry-id>
  audit saved-views list
  audit saved-views save --name <name> [--description <text>] [--preset] [--definition-id <id>] [--status <status>] [--execution-mode <inline|queued>] [--tool-name <name>] [--run-id <id>] [--approval-id <id>] [--step-id <id>] [--dispatch-job-id <id>] [--worker-id <id>] [--tool-call-id <id>] [--tool-id <id>] [--audit-view-run-id <id>] [--drilldown-run-id <id>]
  audit saved-views show <saved-view-id>
  audit saved-views apply <saved-view-id>
  approvals pending
  approvals show <approval-id>
  approvals decide <approval-id> --decision approved|rejected|cancelled [--actor <id>] [--note <text>]

Optional flags:
  --workspace <path>   Override the local workspace state file path
`);
}

function writeJson(write: (message: string) => void, value: unknown): number {
  write(`${JSON.stringify(value, null, 2)}\n`);

  return 0;
}
