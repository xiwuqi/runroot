import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRunrootWorkerService } from "@runroot/sdk";
import { describe, expect, it } from "vitest";

import { runCli } from "./index";

function createIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      stderr: {
        write(message: string) {
          stderr.push(message);
        },
      },
      stdout: {
        write(message: string) {
          stdout.push(message);
        },
      },
    },
    stderr,
    stdout,
  };
}

describe("@runroot/cli integration", () => {
  it("starts a shell runbook and prints timeline data", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-cli-"));
    const inputFile = join(workspaceRoot, "shell-runbook.json");
    await writeFile(
      inputFile,
      JSON.stringify({
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      }),
    );
    const io = createIo();

    const startExitCode = await runCli(
      [
        "--workspace",
        join(workspaceRoot, "workspace.json"),
        "runs",
        "start",
        "shell-runbook-flow",
        "--input-file",
        inputFile,
      ],
      {
        io: io.io,
      },
    );

    expect(startExitCode).toBe(0);

    const startedRun = JSON.parse(io.stdout.join("")) as {
      run: {
        id: string;
        status: string;
      };
    };
    const timelineIo = createIo();
    const auditIo = createIo();

    const timelineExitCode = await runCli(
      [
        "--workspace",
        join(workspaceRoot, "workspace.json"),
        "runs",
        "timeline",
        startedRun.run.id,
      ],
      {
        io: timelineIo.io,
      },
    );

    expect(timelineExitCode).toBe(0);
    const timelinePayload = JSON.parse(timelineIo.stdout.join("")) as {
      timeline: {
        entries: Array<{
          kind: string;
        }>;
      };
    };
    const auditExitCode = await runCli(
      [
        "--workspace",
        join(workspaceRoot, "workspace.json"),
        "runs",
        "audit",
        startedRun.run.id,
      ],
      {
        io: auditIo.io,
      },
    );
    const auditPayload = JSON.parse(auditIo.stdout.join("")) as {
      audit: {
        entries: Array<{
          fact: {
            sourceOfTruth: string;
          };
          kind: string;
        }>;
      };
    };

    expect(startedRun.run.status).toBe("succeeded");
    expect(
      timelinePayload.timeline.entries.map((entry) => entry.kind),
    ).toContain("run-succeeded");
    expect(auditExitCode).toBe(0);
    expect(
      auditPayload.audit.entries.some(
        (entry) =>
          entry.kind === "replay-event" &&
          entry.fact.sourceOfTruth === "runtime-event",
      ),
    ).toBe(true);
    expect(
      auditPayload.audit.entries.some(
        (entry) =>
          entry.kind === "tool-outcome" &&
          entry.fact.sourceOfTruth === "tool-history",
      ),
    ).toBe(true);
  });

  it("lists pending approvals, decides one, and resumes the run", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-cli-approval-"),
    );
    const inputFile = join(workspaceRoot, "slack-approval.json");
    const workspacePath = join(workspaceRoot, "workspace.json");
    await writeFile(
      inputFile,
      JSON.stringify({
        channel: "#ops-approvals",
        operation: "deploy staging",
        reviewerId: "ops-oncall",
        summary: "Promote build 2026.03.27-1 to staging.",
      }),
    );

    const startIo = createIo();
    await runCli(
      [
        "--workspace",
        workspacePath,
        "runs",
        "start",
        "slack-approval-flow",
        "--input-file",
        inputFile,
      ],
      {
        io: startIo.io,
      },
    );
    const startedRun = JSON.parse(startIo.stdout.join("")) as {
      run: {
        id: string;
      };
    };

    const approvalsIo = createIo();
    await runCli(["--workspace", workspacePath, "approvals", "pending"], {
      io: approvalsIo.io,
    });
    const approvalsPayload = JSON.parse(approvalsIo.stdout.join("")) as {
      approvals: Array<{
        approval: {
          id: string;
        };
      }>;
    };

    const approvalId = approvalsPayload.approvals[0]?.approval.id;

    expect(approvalId).toBeDefined();

    const decisionIo = createIo();
    await runCli(
      [
        "--workspace",
        workspacePath,
        "approvals",
        "decide",
        approvalId as string,
        "--decision",
        "approved",
        "--actor",
        "ops-oncall",
      ],
      {
        io: decisionIo.io,
      },
    );

    const resumeIo = createIo();
    const resumeExitCode = await runCli(
      ["--workspace", workspacePath, "runs", "resume", startedRun.run.id],
      {
        io: resumeIo.io,
      },
    );
    const resumedPayload = JSON.parse(resumeIo.stdout.join("")) as {
      run: {
        status: string;
      };
    };

    expect(resumeExitCode).toBe(0);
    expect(resumedPayload.run.status).toBe("succeeded");
  });

  it("uses the SQLite fallback when no legacy workspace path is provided", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-cli-sqlite-"));
    const inputFile = join(workspaceRoot, "shell-runbook.json");
    await writeFile(
      inputFile,
      JSON.stringify({
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      }),
    );
    const startIo = createIo();

    const startExitCode = await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: join(workspaceRoot, "runroot.sqlite"),
        },
        io: startIo.io,
      },
    );

    expect(startExitCode).toBe(0);
    const startedRun = JSON.parse(startIo.stdout.join("")) as {
      run: {
        id: string;
        status: string;
      };
      workspacePath: string;
    };
    const timelineIo = createIo();
    const timelineExitCode = await runCli(
      ["runs", "timeline", startedRun.run.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: join(workspaceRoot, "runroot.sqlite"),
        },
        io: timelineIo.io,
      },
    );
    const timelinePayload = JSON.parse(timelineIo.stdout.join("")) as {
      timeline: {
        entries: Array<{
          kind: string;
        }>;
      };
    };

    expect(startedRun.workspacePath).toContain("runroot.sqlite");
    expect(startedRun.run.status).toBe("succeeded");
    expect(timelineExitCode).toBe(0);
    expect(
      timelinePayload.timeline.entries.map((entry) => entry.kind),
    ).toContain("run-succeeded");
  });

  it("lists cross-run audit results through the CLI for inline and queued runs", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-cli-audit-"));
    const sqlitePath = join(workspaceRoot, "runroot.sqlite");
    const inputFile = join(workspaceRoot, "shell-runbook.json");
    await writeFile(
      inputFile,
      JSON.stringify({
        approvalRequired: false,
        commandAlias: "print-ready",
        runbookId: "node-health-check",
      }),
    );
    const inlineStartIo = createIo();
    const queuedStartIo = createIo();
    const queryIo = createIo();

    await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inlineStartIo.io,
      },
    );
    const inlineRun = JSON.parse(inlineStartIo.stdout.join("")) as {
      run: {
        id: string;
      };
    };

    await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_EXECUTION_MODE: "queued",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: queuedStartIo.io,
      },
    );
    const queuedRun = JSON.parse(queuedStartIo.stdout.join("")) as {
      run: {
        id: string;
        status: string;
      };
    };

    const worker = createRunrootWorkerService({
      persistenceDriver: "sqlite",
      sqlitePath,
      workerId: "worker_cli",
    });
    await worker.processNextJob();

    const queryExitCode = await runCli(
      ["audit", "list", "--execution-mode", "queued"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: queryIo.io,
      },
    );
    const queryPayload = JSON.parse(queryIo.stdout.join("")) as {
      audit: {
        results: Array<{
          dispatchJobs: Array<{
            workerId?: string;
          }>;
          executionModes: string[];
          runId: string;
        }>;
      };
    };

    expect(queryExitCode).toBe(0);
    expect(queuedRun.run.status).toBe("queued");
    expect(
      queryPayload.audit.results.some(
        (result) =>
          result.runId === queuedRun.run.id &&
          result.executionModes.includes("queued") &&
          result.dispatchJobs.some(
            (dispatchJob) => dispatchJob.workerId === "worker_cli",
          ),
      ),
    ).toBe(true);
    expect(
      queryPayload.audit.results.some(
        (result) => result.runId === inlineRun.run.id,
      ),
    ).toBe(false);
  });
});
