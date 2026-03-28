#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import type { PackageBoundary } from "@runroot/config";
import type { JsonValue } from "@runroot/domain";
import {
  createRunrootOperatorService,
  type DecideApprovalInput,
  OperatorError,
  resolveWorkspacePath,
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
    const [resource, action, subject] = positionals;

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

function getStringFlag(
  flags: ReadonlyMap<string, string | boolean>,
  name: string,
): string | undefined {
  const value = flags.get(name);

  return typeof value === "string" ? value : undefined;
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
