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

  it("lists cross-run audit drilldowns through the CLI for inline and queued runs", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-cli-drilldown-"),
    );
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
    const inlineQueryIo = createIo();
    const queuedQueryIo = createIo();

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

    const worker = createRunrootWorkerService({
      persistenceDriver: "sqlite",
      sqlitePath,
      workerId: "worker_cli_drilldown",
    });
    await worker.processNextJob();

    const inlineExitCode = await runCli(
      ["audit", "drilldown", "--run-id", inlineRun.run.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inlineQueryIo.io,
      },
    );
    const queuedExitCode = await runCli(
      ["audit", "drilldown", "--worker-id", "worker_cli_drilldown"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: queuedQueryIo.io,
      },
    );
    const inlinePayload = JSON.parse(inlineQueryIo.stdout.join("")) as {
      audit: {
        results: Array<{
          runId: string;
        }>;
      };
    };
    const queuedPayload = JSON.parse(queuedQueryIo.stdout.join("")) as {
      audit: {
        results: Array<{
          identifiers: {
            workerIds: string[];
          };
        }>;
      };
    };

    expect(inlineExitCode).toBe(0);
    expect(inlinePayload.audit.results[0]?.runId).toBe(inlineRun.run.id);
    expect(queuedExitCode).toBe(0);
    expect(queuedPayload.audit.results[0]?.identifiers.workerIds).toContain(
      "worker_cli_drilldown",
    );
  });

  it("navigates summaries, drilldowns, and run audit views through the CLI", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-cli-nav-"));
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
    const allNavigationIo = createIo();
    const queuedNavigationIo = createIo();

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
      };
    };

    const worker = createRunrootWorkerService({
      persistenceDriver: "sqlite",
      sqlitePath,
      workerId: "worker_cli_navigation",
    });
    await worker.processNextJob();

    const allNavigationExitCode = await runCli(["audit", "navigate"], {
      cwd: workspaceRoot,
      env: {
        RUNROOT_PERSISTENCE_DRIVER: "sqlite",
        RUNROOT_SQLITE_PATH: sqlitePath,
      },
      io: allNavigationIo.io,
    });
    const queuedNavigationExitCode = await runCli(
      [
        "audit",
        "navigate",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_navigation",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: queuedNavigationIo.io,
      },
    );
    const allNavigationPayload = JSON.parse(
      allNavigationIo.stdout.join(""),
    ) as {
      audit: {
        isConstrained: boolean;
        summaries: Array<{
          links: {
            auditView: {
              kind: string;
              runId: string;
            };
          };
          result: {
            runId: string;
          };
        }>;
        totalSummaryCount: number;
      };
    };
    const queuedNavigationPayload = JSON.parse(
      queuedNavigationIo.stdout.join(""),
    ) as {
      audit: {
        drilldowns: Array<{
          links: {
            auditView: {
              kind: string;
              runId: string;
            };
          };
          result: {
            runId: string;
          };
        }>;
        isConstrained: boolean;
        summaries: Array<{
          links: {
            drilldowns: Array<{
              filters: {
                workerId?: string;
              };
            }>;
          };
          result: {
            runId: string;
          };
        }>;
      };
    };

    expect(allNavigationExitCode).toBe(0);
    expect(allNavigationPayload.audit.isConstrained).toBe(false);
    expect(allNavigationPayload.audit.totalSummaryCount).toBe(2);
    expect(
      allNavigationPayload.audit.summaries.map(
        (summary) => summary.result.runId,
      ),
    ).toEqual([queuedRun.run.id, inlineRun.run.id]);
    expect(
      allNavigationPayload.audit.summaries.some(
        (summary) =>
          summary.links.auditView.kind === "run-audit-view" &&
          summary.links.auditView.runId === inlineRun.run.id,
      ),
    ).toBe(true);
    expect(queuedNavigationExitCode).toBe(0);
    expect(queuedNavigationPayload.audit.isConstrained).toBe(true);
    expect(queuedNavigationPayload.audit.summaries[0]?.result.runId).toBe(
      queuedRun.run.id,
    );
    expect(
      queuedNavigationPayload.audit.summaries[0]?.links.drilldowns.some(
        (link) => link.filters.workerId === "worker_cli_navigation",
      ),
    ).toBe(true);
    expect(queuedNavigationPayload.audit.drilldowns[0]).toMatchObject({
      links: {
        auditView: {
          kind: "run-audit-view",
          runId: queuedRun.run.id,
        },
      },
      result: {
        runId: queuedRun.run.id,
      },
    });
  });

  it("saves, lists, shows, and applies saved audit views through the CLI", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-cli-saved-"));
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
    const saveIo = createIo();
    const listIo = createIo();
    const showIo = createIo();
    const applyIo = createIo();

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
      };
    };

    const worker = createRunrootWorkerService({
      persistenceDriver: "sqlite",
      sqlitePath,
      workerId: "worker_cli_saved",
    });
    await worker.processNextJob();

    const saveExitCode = await runCli(
      [
        "audit",
        "saved-views",
        "save",
        "--name",
        "Queued worker follow-up",
        "--description",
        "Saved queued worker investigation",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_saved",
        "--audit-view-run-id",
        queuedRun.run.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: saveIo.io,
      },
    );
    const savedViewPayload = JSON.parse(saveIo.stdout.join("")) as {
      savedView: {
        id: string;
      };
    };
    const listExitCode = await runCli(["audit", "saved-views", "list"], {
      cwd: workspaceRoot,
      env: {
        RUNROOT_PERSISTENCE_DRIVER: "sqlite",
        RUNROOT_SQLITE_PATH: sqlitePath,
      },
      io: listIo.io,
    });
    const showExitCode = await runCli(
      ["audit", "saved-views", "show", savedViewPayload.savedView.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: showIo.io,
      },
    );
    const applyExitCode = await runCli(
      ["audit", "saved-views", "apply", savedViewPayload.savedView.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: applyIo.io,
      },
    );
    const listPayload = JSON.parse(listIo.stdout.join("")) as {
      savedViews: {
        items: Array<{
          id: string;
        }>;
        totalCount: number;
      };
    };
    const showPayload = JSON.parse(showIo.stdout.join("")) as {
      savedView: {
        refs: {
          auditViewRunId?: string;
        };
      };
    };
    const applyPayload = JSON.parse(applyIo.stdout.join("")) as {
      application: {
        navigation: {
          drilldowns: Array<{
            result: {
              runId: string;
            };
          }>;
          totalSummaryCount: number;
        };
        savedView: {
          id: string;
        };
      };
    };

    expect(saveExitCode).toBe(0);
    expect(listExitCode).toBe(0);
    expect(showExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(listPayload.savedViews.totalCount).toBe(1);
    expect(listPayload.savedViews.items[0]?.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(showPayload.savedView.refs.auditViewRunId).toBe(queuedRun.run.id);
    expect(applyPayload.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(applyPayload.application.navigation.totalSummaryCount).toBe(1);
    expect(
      applyPayload.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(queuedRun.run.id);
  });

  it("publishes, shares, lists-visible, inspects, unshares, archives, and applies audit view catalog entries through the CLI", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-cli-catalog-"));
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
    const saveIo = createIo();
    const publishIo = createIo();
    const listIo = createIo();
    const visibleIo = createIo();
    const inspectIo = createIo();
    const shareIo = createIo();
    const showIo = createIo();
    const applyIo = createIo();
    const unshareIo = createIo();
    const archiveIo = createIo();
    const listAfterArchiveIo = createIo();

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
      };
    };

    const worker = createRunrootWorkerService({
      persistenceDriver: "sqlite",
      sqlitePath,
      workerId: "worker_cli_catalog",
    });
    await worker.processNextJob();

    await runCli(
      [
        "audit",
        "saved-views",
        "save",
        "--name",
        "Queued worker preset",
        "--description",
        "Saved queued worker investigation",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_catalog",
        "--audit-view-run-id",
        queuedRun.run.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: saveIo.io,
      },
    );
    const savedViewPayload = JSON.parse(saveIo.stdout.join("")) as {
      savedView: {
        id: string;
      };
    };

    const publishExitCode = await runCli(
      ["audit", "catalog", "publish", savedViewPayload.savedView.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: publishIo.io,
      },
    );
    const publishedPayload = JSON.parse(publishIo.stdout.join("")) as {
      catalogEntry: {
        entry: {
          id: string;
        };
      };
    };
    const listExitCode = await runCli(["audit", "catalog", "list"], {
      cwd: workspaceRoot,
      env: {
        RUNROOT_PERSISTENCE_DRIVER: "sqlite",
        RUNROOT_SQLITE_PATH: sqlitePath,
      },
      io: listIo.io,
    });
    const visibleExitCode = await runCli(["audit", "catalog", "visible"], {
      cwd: workspaceRoot,
      env: {
        RUNROOT_PERSISTENCE_DRIVER: "sqlite",
        RUNROOT_SQLITE_PATH: sqlitePath,
      },
      io: visibleIo.io,
    });
    const inspectExitCode = await runCli(
      ["audit", "catalog", "inspect", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inspectIo.io,
      },
    );
    const shareExitCode = await runCli(
      ["audit", "catalog", "share", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: shareIo.io,
      },
    );
    const showExitCode = await runCli(
      ["audit", "catalog", "show", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: showIo.io,
      },
    );
    const applyExitCode = await runCli(
      ["audit", "catalog", "apply", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: applyIo.io,
      },
    );
    const unshareExitCode = await runCli(
      ["audit", "catalog", "unshare", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: unshareIo.io,
      },
    );
    const archiveExitCode = await runCli(
      ["audit", "catalog", "archive", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: archiveIo.io,
      },
    );
    const listAfterArchiveExitCode = await runCli(
      ["audit", "catalog", "list"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: listAfterArchiveIo.io,
      },
    );
    const listPayload = JSON.parse(listIo.stdout.join("")) as {
      catalog: {
        items: Array<{
          entry: {
            id: string;
          };
        }>;
        totalCount: number;
      };
    };
    const visiblePayload = JSON.parse(visibleIo.stdout.join("")) as {
      visibility: {
        items: Array<{
          visibility: {
            state: "personal" | "shared";
          };
        }>;
        totalCount: number;
      };
    };
    const inspectPayload = JSON.parse(inspectIo.stdout.join("")) as {
      visibility: {
        visibility: {
          state: "personal" | "shared";
        };
      };
    };
    const sharePayload = JSON.parse(shareIo.stdout.join("")) as {
      visibility: {
        visibility: {
          scopeId: string;
          state: "personal" | "shared";
        };
      };
    };
    const showPayload = JSON.parse(showIo.stdout.join("")) as {
      catalogEntry: {
        savedView: {
          refs: {
            auditViewRunId?: string;
          };
        };
      };
    };
    const applyPayload = JSON.parse(applyIo.stdout.join("")) as {
      application: {
        application: {
          navigation: {
            drilldowns: Array<{
              result: {
                runId: string;
              };
            }>;
            totalSummaryCount: number;
          };
        };
        catalogEntry: {
          entry: {
            id: string;
          };
        };
      };
    };
    const unsharePayload = JSON.parse(unshareIo.stdout.join("")) as {
      visibility: {
        visibility: {
          ownerId: string;
          state: "personal" | "shared";
        };
      };
    };
    const archivePayload = JSON.parse(archiveIo.stdout.join("")) as {
      catalogEntry: {
        entry: {
          archivedAt?: string;
        };
      };
    };
    const listAfterArchivePayload = JSON.parse(
      listAfterArchiveIo.stdout.join(""),
    ) as {
      catalog: {
        totalCount: number;
      };
    };

    expect(publishExitCode).toBe(0);
    expect(listExitCode).toBe(0);
    expect(visibleExitCode).toBe(0);
    expect(inspectExitCode).toBe(0);
    expect(shareExitCode).toBe(0);
    expect(showExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(unshareExitCode).toBe(0);
    expect(archiveExitCode).toBe(0);
    expect(listAfterArchiveExitCode).toBe(0);
    expect(listPayload.catalog.totalCount).toBe(1);
    expect(visiblePayload.visibility.totalCount).toBe(1);
    expect(visiblePayload.visibility.items[0]?.visibility.state).toBe(
      "personal",
    );
    expect(inspectPayload.visibility.visibility.state).toBe("personal");
    expect(sharePayload.visibility.visibility.state).toBe("shared");
    expect(sharePayload.visibility.visibility.scopeId).toBe("workspace");
    expect(showPayload.catalogEntry.savedView.refs.auditViewRunId).toBe(
      queuedRun.run.id,
    );
    expect(applyPayload.application.catalogEntry.entry.id).toBe(
      publishedPayload.catalogEntry.entry.id,
    );
    expect(
      applyPayload.application.application.navigation.totalSummaryCount,
    ).toBe(1);
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.run.id);
    expect(unsharePayload.visibility.visibility.state).toBe("personal");
    expect(unsharePayload.visibility.visibility.ownerId).toBe("operator");
    expect(archivePayload.catalogEntry.entry.archivedAt).toBeTruthy();
    expect(listAfterArchivePayload.catalog.totalCount).toBe(0);
  });
});
