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

  it("reviews, lists-reviewed, inspects, clears, and reapplies reviewed catalog entries through the CLI", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-cli-review-signals-"),
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
    const saveIo = createIo();
    const publishIo = createIo();
    const shareIo = createIo();
    const reviewIo = createIo();
    const reviewedIo = createIo();
    const inspectReviewIo = createIo();
    const applyIo = createIo();
    const clearReviewIo = createIo();
    const reviewedAfterClearIo = createIo();

    await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
      workerId: "worker_cli_review",
    });
    await worker.processNextJob();

    await runCli(
      [
        "audit",
        "saved-views",
        "save",
        "--name",
        "Queued review preset",
        "--description",
        "Saved queued worker review preset",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_review",
        "--audit-view-run-id",
        queuedRun.run.id,
        "--drilldown-run-id",
        queuedRun.run.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
    const shareExitCode = await runCli(
      ["audit", "catalog", "share", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: shareIo.io,
      },
    );
    const reviewExitCode = await runCli(
      [
        "audit",
        "catalog",
        "review",
        publishedPayload.catalogEntry.entry.id,
        "--state",
        "recommended",
        "--note",
        `Queued preset reviewed after inline ${inlineRun.run.id}`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: reviewIo.io,
      },
    );
    const reviewedExitCode = await runCli(["audit", "catalog", "reviewed"], {
      cwd: workspaceRoot,
      env: {
        RUNROOT_OPERATOR_ID: "ops_oncall",
        RUNROOT_OPERATOR_SCOPE: "ops",
        RUNROOT_PERSISTENCE_DRIVER: "sqlite",
        RUNROOT_SQLITE_PATH: sqlitePath,
      },
      io: reviewedIo.io,
    });
    const inspectReviewExitCode = await runCli(
      [
        "audit",
        "catalog",
        "inspect-review",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inspectReviewIo.io,
      },
    );
    const applyExitCode = await runCli(
      ["audit", "catalog", "apply", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: applyIo.io,
      },
    );
    const clearReviewExitCode = await runCli(
      [
        "audit",
        "catalog",
        "clear-review",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: clearReviewIo.io,
      },
    );
    const reviewedAfterClearExitCode = await runCli(
      ["audit", "catalog", "reviewed"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: reviewedAfterClearIo.io,
      },
    );
    const sharePayload = JSON.parse(shareIo.stdout.join("")) as {
      visibility: {
        visibility: {
          state: "shared";
        };
      };
    };
    const reviewPayload = JSON.parse(reviewIo.stdout.join("")) as {
      review: {
        review: {
          note?: string;
          state: "recommended" | "reviewed";
        };
      };
    };
    const reviewedPayload = JSON.parse(reviewedIo.stdout.join("")) as {
      reviewed: {
        items: Array<{
          review: {
            note?: string;
            state: "recommended" | "reviewed";
          };
          visibility: {
            catalogEntry: {
              entry: {
                id: string;
              };
              savedView: {
                refs: {
                  auditViewRunId?: string;
                };
              };
            };
          };
        }>;
        totalCount: number;
      };
    };
    const inspectReviewPayload = JSON.parse(
      inspectReviewIo.stdout.join(""),
    ) as {
      review: {
        review: {
          note?: string;
          state: "recommended" | "reviewed";
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
      };
    };
    const clearReviewPayload = JSON.parse(clearReviewIo.stdout.join("")) as {
      review: {
        review: {
          state: "recommended" | "reviewed";
        };
      };
    };
    const reviewedAfterClearPayload = JSON.parse(
      reviewedAfterClearIo.stdout.join(""),
    ) as {
      reviewed: {
        totalCount: number;
      };
    };

    expect(publishExitCode).toBe(0);
    expect(shareExitCode).toBe(0);
    expect(reviewExitCode).toBe(0);
    expect(reviewedExitCode).toBe(0);
    expect(inspectReviewExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(clearReviewExitCode).toBe(0);
    expect(reviewedAfterClearExitCode).toBe(0);
    expect(sharePayload.visibility.visibility.state).toBe("shared");
    expect(reviewPayload.review.review.state).toBe("recommended");
    expect(reviewPayload.review.review.note).toContain(inlineRun.run.id);
    expect(reviewedPayload.reviewed.totalCount).toBe(1);
    expect(
      reviewedPayload.reviewed.items[0]?.visibility.catalogEntry.entry.id,
    ).toBe(publishedPayload.catalogEntry.entry.id);
    expect(
      reviewedPayload.reviewed.items[0]?.visibility.catalogEntry.savedView.refs
        .auditViewRunId,
    ).toBe(queuedRun.run.id);
    expect(inspectReviewPayload.review.review.note).toContain("Queued preset");
    expect(
      applyPayload.application.application.navigation.totalSummaryCount,
    ).toBe(1);
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.run.id);
    expect(clearReviewPayload.review.review.state).toBe("recommended");
    expect(reviewedAfterClearPayload.reviewed.totalCount).toBe(0);
  });

  it("assigns, lists-assigned, inspects, clears, and reapplies reviewed catalog entries through the CLI", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-cli-review-assignments-"),
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
    const saveIo = createIo();
    const publishIo = createIo();
    const shareIo = createIo();
    const reviewIo = createIo();
    const assignIo = createIo();
    const assignedOwnerIo = createIo();
    const inspectAssignmentIo = createIo();
    const assignedPeerIo = createIo();
    const applyIo = createIo();
    const clearAssignmentIo = createIo();
    const assignedAfterClearIo = createIo();

    await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
      workerId: "worker_cli_assignment",
    });
    await worker.processNextJob();

    await runCli(
      [
        "audit",
        "saved-views",
        "save",
        "--name",
        "Queued assignment preset",
        "--description",
        "Saved queued worker assignment preset",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_assignment",
        "--audit-view-run-id",
        queuedRun.run.id,
        "--drilldown-run-id",
        queuedRun.run.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
    const shareExitCode = await runCli(
      ["audit", "catalog", "share", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: shareIo.io,
      },
    );
    const reviewExitCode = await runCli(
      [
        "audit",
        "catalog",
        "review",
        publishedPayload.catalogEntry.entry.id,
        "--state",
        "recommended",
        "--note",
        `Queued preset reviewed after inline ${inlineRun.run.id}`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: reviewIo.io,
      },
    );
    const assignExitCode = await runCli(
      [
        "audit",
        "catalog",
        "assign",
        publishedPayload.catalogEntry.entry.id,
        "--assignee",
        "ops_backup",
        "--handoff-note",
        `Queued worker ${queuedRun.run.id} handed to backup`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: assignIo.io,
      },
    );
    const assignedOwnerExitCode = await runCli(
      ["audit", "catalog", "assigned"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: assignedOwnerIo.io,
      },
    );
    const inspectAssignmentExitCode = await runCli(
      [
        "audit",
        "catalog",
        "inspect-assignment",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inspectAssignmentIo.io,
      },
    );
    const assignedPeerExitCode = await runCli(
      ["audit", "catalog", "assigned"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: assignedPeerIo.io,
      },
    );
    const applyExitCode = await runCli(
      ["audit", "catalog", "apply", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: applyIo.io,
      },
    );
    const clearAssignmentExitCode = await runCli(
      [
        "audit",
        "catalog",
        "clear-assignment",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: clearAssignmentIo.io,
      },
    );
    const assignedAfterClearExitCode = await runCli(
      ["audit", "catalog", "assigned"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: assignedAfterClearIo.io,
      },
    );
    const sharePayload = JSON.parse(shareIo.stdout.join("")) as {
      visibility: {
        visibility: {
          state: "shared";
        };
      };
    };
    const reviewPayload = JSON.parse(reviewIo.stdout.join("")) as {
      review: {
        review: {
          note?: string;
          state: "recommended" | "reviewed";
        };
      };
    };
    const assignPayload = JSON.parse(assignIo.stdout.join("")) as {
      assignment: {
        assignment: {
          assigneeId: string;
          assignerId: string;
          handoffNote?: string;
          state: "assigned";
        };
      };
    };
    const assignedOwnerPayload = JSON.parse(
      assignedOwnerIo.stdout.join(""),
    ) as {
      assigned: {
        items: Array<{
          assignment: {
            assigneeId: string;
          };
          review: {
            visibility: {
              catalogEntry: {
                entry: {
                  id: string;
                };
              };
            };
          };
        }>;
        totalCount: number;
      };
    };
    const inspectAssignmentPayload = JSON.parse(
      inspectAssignmentIo.stdout.join(""),
    ) as {
      assignment: {
        assignment: {
          assigneeId: string;
          handoffNote?: string;
        };
      };
    };
    const assignedPeerPayload = JSON.parse(assignedPeerIo.stdout.join("")) as {
      assigned: {
        items: Array<{
          review: {
            visibility: {
              catalogEntry: {
                entry: {
                  id: string;
                };
              };
            };
          };
        }>;
        totalCount: number;
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
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearAssignmentPayload = JSON.parse(
      clearAssignmentIo.stdout.join(""),
    ) as {
      assignment: {
        assignment: {
          assigneeId: string;
          state: "assigned";
        };
      };
    };
    const assignedAfterClearPayload = JSON.parse(
      assignedAfterClearIo.stdout.join(""),
    ) as {
      assigned: {
        totalCount: number;
      };
    };

    expect(publishExitCode).toBe(0);
    expect(shareExitCode).toBe(0);
    expect(reviewExitCode).toBe(0);
    expect(assignExitCode).toBe(0);
    expect(assignedOwnerExitCode).toBe(0);
    expect(inspectAssignmentExitCode).toBe(0);
    expect(assignedPeerExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(clearAssignmentExitCode).toBe(0);
    expect(assignedAfterClearExitCode).toBe(0);
    expect(sharePayload.visibility.visibility.state).toBe("shared");
    expect(reviewPayload.review.review.state).toBe("recommended");
    expect(reviewPayload.review.review.note).toContain(inlineRun.run.id);
    expect(assignPayload.assignment.assignment).toMatchObject({
      assigneeId: "ops_backup",
      assignerId: "ops_oncall",
      handoffNote: `Queued worker ${queuedRun.run.id} handed to backup`,
      state: "assigned",
    });
    expect(assignedOwnerPayload.assigned.totalCount).toBe(1);
    expect(
      assignedOwnerPayload.assigned.items[0]?.review.visibility.catalogEntry
        .entry.id,
    ).toBe(publishedPayload.catalogEntry.entry.id);
    expect(assignedOwnerPayload.assigned.items[0]?.assignment.assigneeId).toBe(
      "ops_backup",
    );
    expect(inspectAssignmentPayload.assignment.assignment.assigneeId).toBe(
      "ops_backup",
    );
    expect(
      inspectAssignmentPayload.assignment.assignment.handoffNote,
    ).toContain(queuedRun.run.id);
    expect(assignedPeerPayload.assigned.totalCount).toBe(1);
    expect(
      assignedPeerPayload.assigned.items[0]?.review.visibility.catalogEntry
        .entry.id,
    ).toBe(publishedPayload.catalogEntry.entry.id);
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(
      applyPayload.application.application.navigation.totalSummaryCount,
    ).toBe(1);
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.run.id);
    expect(clearAssignmentPayload.assignment.assignment.assigneeId).toBe(
      "ops_backup",
    );
    expect(clearAssignmentPayload.assignment.assignment.state).toBe("assigned");
    expect(assignedAfterClearPayload.assigned.totalCount).toBe(0);
  });

  it("checklists, lists-checklisted, inspects, clears, and reapplies assigned catalog entries through the CLI", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-cli-assignment-checklists-"),
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
    const saveIo = createIo();
    const publishIo = createIo();
    const shareIo = createIo();
    const reviewIo = createIo();
    const assignIo = createIo();
    const checklistIo = createIo();
    const checklistedPeerIo = createIo();
    const inspectChecklistIo = createIo();
    const applyIo = createIo();
    const clearChecklistIo = createIo();
    const checklistedAfterClearIo = createIo();

    await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
      workerId: "worker_cli_checklist",
    });
    await worker.processNextJob();

    await runCli(
      [
        "audit",
        "saved-views",
        "save",
        "--name",
        "Queued checklist preset",
        "--description",
        "Saved queued worker checklist preset",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_checklist",
        "--audit-view-run-id",
        queuedRun.run.id,
        "--drilldown-run-id",
        queuedRun.run.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
    const shareExitCode = await runCli(
      ["audit", "catalog", "share", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: shareIo.io,
      },
    );
    const reviewExitCode = await runCli(
      [
        "audit",
        "catalog",
        "review",
        publishedPayload.catalogEntry.entry.id,
        "--state",
        "recommended",
        "--note",
        `Checklist ready after inline ${inlineRun.run.id}`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: reviewIo.io,
      },
    );
    const assignExitCode = await runCli(
      [
        "audit",
        "catalog",
        "assign",
        publishedPayload.catalogEntry.entry.id,
        "--assignee",
        "ops_backup",
        "--handoff-note",
        `Queued worker ${queuedRun.run.id} handed to backup`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: assignIo.io,
      },
    );
    const checklistExitCode = await runCli(
      [
        "audit",
        "catalog",
        "checklist",
        publishedPayload.catalogEntry.entry.id,
        "--status",
        "pending",
        "--items-json",
        JSON.stringify(["Validate queued follow-up", "Close backup handoff"]),
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: checklistIo.io,
      },
    );
    const checklistedPeerExitCode = await runCli(
      ["audit", "catalog", "checklisted"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: checklistedPeerIo.io,
      },
    );
    const inspectChecklistExitCode = await runCli(
      [
        "audit",
        "catalog",
        "inspect-checklist",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inspectChecklistIo.io,
      },
    );
    const applyExitCode = await runCli(
      ["audit", "catalog", "apply", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: applyIo.io,
      },
    );
    const clearChecklistExitCode = await runCli(
      [
        "audit",
        "catalog",
        "clear-checklist",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: clearChecklistIo.io,
      },
    );
    const checklistedAfterClearExitCode = await runCli(
      ["audit", "catalog", "checklisted"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: checklistedAfterClearIo.io,
      },
    );
    const sharePayload = JSON.parse(shareIo.stdout.join("")) as {
      visibility: {
        visibility: {
          state: "shared";
        };
      };
    };
    const reviewPayload = JSON.parse(reviewIo.stdout.join("")) as {
      review: {
        review: {
          note?: string;
          state: "recommended" | "reviewed";
        };
      };
    };
    const assignPayload = JSON.parse(assignIo.stdout.join("")) as {
      assignment: {
        assignment: {
          assigneeId: string;
          assignerId: string;
          handoffNote?: string;
          state: "assigned";
        };
      };
    };
    const checklistPayload = JSON.parse(checklistIo.stdout.join("")) as {
      checklist: {
        assignment: {
          assignment: {
            assigneeId: string;
          };
        };
        checklist: {
          items?: readonly string[];
          state: "completed" | "pending";
        };
      };
    };
    const checklistedPeerPayload = JSON.parse(
      checklistedPeerIo.stdout.join(""),
    ) as {
      checklisted: {
        items: Array<{
          assignment: {
            review: {
              visibility: {
                catalogEntry: {
                  entry: {
                    id: string;
                  };
                };
              };
            };
          };
          checklist: {
            state: "completed" | "pending";
          };
        }>;
        totalCount: number;
      };
    };
    const inspectChecklistPayload = JSON.parse(
      inspectChecklistIo.stdout.join(""),
    ) as {
      checklist: {
        checklist: {
          items?: readonly string[];
          state: "completed" | "pending";
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
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearChecklistPayload = JSON.parse(
      clearChecklistIo.stdout.join(""),
    ) as {
      checklist: {
        checklist: {
          state: "completed" | "pending";
        };
      };
    };
    const checklistedAfterClearPayload = JSON.parse(
      checklistedAfterClearIo.stdout.join(""),
    ) as {
      checklisted: {
        totalCount: number;
      };
    };

    expect(publishExitCode).toBe(0);
    expect(shareExitCode).toBe(0);
    expect(reviewExitCode).toBe(0);
    expect(assignExitCode).toBe(0);
    expect(checklistExitCode).toBe(0);
    expect(checklistedPeerExitCode).toBe(0);
    expect(inspectChecklistExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(clearChecklistExitCode).toBe(0);
    expect(checklistedAfterClearExitCode).toBe(0);
    expect(sharePayload.visibility.visibility.state).toBe("shared");
    expect(reviewPayload.review.review.state).toBe("recommended");
    expect(reviewPayload.review.review.note).toContain(inlineRun.run.id);
    expect(assignPayload.assignment.assignment).toMatchObject({
      assigneeId: "ops_backup",
      assignerId: "ops_oncall",
      handoffNote: `Queued worker ${queuedRun.run.id} handed to backup`,
      state: "assigned",
    });
    expect(checklistPayload.checklist.assignment.assignment.assigneeId).toBe(
      "ops_backup",
    );
    expect(checklistPayload.checklist.checklist.state).toBe("pending");
    expect(checklistPayload.checklist.checklist.items).toEqual([
      "Validate queued follow-up",
      "Close backup handoff",
    ]);
    expect(checklistedPeerPayload.checklisted.totalCount).toBe(1);
    expect(
      checklistedPeerPayload.checklisted.items[0]?.assignment.review.visibility
        .catalogEntry.entry.id,
    ).toBe(publishedPayload.catalogEntry.entry.id);
    expect(checklistedPeerPayload.checklisted.items[0]?.checklist.state).toBe(
      "pending",
    );
    expect(inspectChecklistPayload.checklist.checklist.items).toEqual([
      "Validate queued follow-up",
      "Close backup handoff",
    ]);
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(
      applyPayload.application.application.navigation.totalSummaryCount,
    ).toBe(1);
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.run.id);
    expect(clearChecklistPayload.checklist.checklist.state).toBe("pending");
    expect(checklistedAfterClearPayload.checklisted.totalCount).toBe(0);
  });

  it("progresses, lists-progressed, inspects, clears, and reapplies checklisted catalog entries through the CLI", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-cli-checklist-progress-"),
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
    const saveIo = createIo();
    const publishIo = createIo();
    const shareIo = createIo();
    const reviewIo = createIo();
    const assignIo = createIo();
    const checklistIo = createIo();
    const progressIo = createIo();
    const progressedPeerIo = createIo();
    const inspectProgressIo = createIo();
    const applyIo = createIo();
    const clearProgressIo = createIo();
    const progressedAfterClearIo = createIo();

    await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
      workerId: "worker_cli_progress",
    });
    await worker.processNextJob();

    await runCli(
      [
        "audit",
        "saved-views",
        "save",
        "--name",
        "Queued progress preset",
        "--description",
        "Saved queued worker progress preset",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_progress",
        "--audit-view-run-id",
        queuedRun.run.id,
        "--drilldown-run-id",
        queuedRun.run.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
    const shareExitCode = await runCli(
      ["audit", "catalog", "share", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: shareIo.io,
      },
    );
    const reviewExitCode = await runCli(
      [
        "audit",
        "catalog",
        "review",
        publishedPayload.catalogEntry.entry.id,
        "--state",
        "recommended",
        "--note",
        `Progress ready after inline ${inlineRun.run.id}`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: reviewIo.io,
      },
    );
    const assignExitCode = await runCli(
      [
        "audit",
        "catalog",
        "assign",
        publishedPayload.catalogEntry.entry.id,
        "--assignee",
        "ops_backup",
        "--handoff-note",
        `Queued worker ${queuedRun.run.id} handed to backup`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: assignIo.io,
      },
    );
    const checklistExitCode = await runCli(
      [
        "audit",
        "catalog",
        "checklist",
        publishedPayload.catalogEntry.entry.id,
        "--status",
        "pending",
        "--items-json",
        JSON.stringify(["Validate queued follow-up", "Close backup handoff"]),
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: checklistIo.io,
      },
    );
    const progressExitCode = await runCli(
      [
        "audit",
        "catalog",
        "progress",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "completed",
          },
          {
            item: "Close backup handoff",
            state: "pending",
          },
        ]),
        "--completion-note",
        "Queued follow-up is almost complete",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: progressIo.io,
      },
    );
    const progressedPeerExitCode = await runCli(
      ["audit", "catalog", "progressed"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: progressedPeerIo.io,
      },
    );
    const inspectProgressExitCode = await runCli(
      [
        "audit",
        "catalog",
        "inspect-progress",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inspectProgressIo.io,
      },
    );
    const applyExitCode = await runCli(
      ["audit", "catalog", "apply", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: applyIo.io,
      },
    );
    const clearProgressExitCode = await runCli(
      [
        "audit",
        "catalog",
        "clear-progress",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: clearProgressIo.io,
      },
    );
    const progressedAfterClearExitCode = await runCli(
      ["audit", "catalog", "progressed"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: progressedAfterClearIo.io,
      },
    );
    const progressPayload = JSON.parse(progressIo.stdout.join("")) as {
      progress: {
        progress: {
          completionNote?: string;
          items: Array<{
            item: string;
            state: "completed" | "pending";
          }>;
        };
      };
    };
    const progressedPeerPayload = JSON.parse(
      progressedPeerIo.stdout.join(""),
    ) as {
      progressed: {
        items: Array<{
          checklist: {
            assignment: {
              review: {
                visibility: {
                  catalogEntry: {
                    entry: {
                      id: string;
                    };
                  };
                };
              };
            };
          };
        }>;
        totalCount: number;
      };
    };
    const inspectProgressPayload = JSON.parse(
      inspectProgressIo.stdout.join(""),
    ) as {
      progress: {
        progress: {
          completionNote?: string;
          items: Array<{
            item: string;
            state: "completed" | "pending";
          }>;
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
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearProgressPayload = JSON.parse(
      clearProgressIo.stdout.join(""),
    ) as {
      progress: {
        progress: {
          completionNote?: string;
        };
      };
    };
    const progressedAfterClearPayload = JSON.parse(
      progressedAfterClearIo.stdout.join(""),
    ) as {
      progressed: {
        totalCount: number;
      };
    };

    expect(publishExitCode).toBe(0);
    expect(shareExitCode).toBe(0);
    expect(reviewExitCode).toBe(0);
    expect(assignExitCode).toBe(0);
    expect(checklistExitCode).toBe(0);
    expect(progressExitCode).toBe(0);
    expect(progressedPeerExitCode).toBe(0);
    expect(inspectProgressExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(clearProgressExitCode).toBe(0);
    expect(progressedAfterClearExitCode).toBe(0);
    expect(progressPayload.progress.progress.completionNote).toBe(
      "Queued follow-up is almost complete",
    );
    expect(progressPayload.progress.progress.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "completed",
      },
      {
        item: "Close backup handoff",
        state: "pending",
      },
    ]);
    expect(progressedPeerPayload.progressed.totalCount).toBe(1);
    expect(
      progressedPeerPayload.progressed.items[0]?.checklist.assignment.review
        .visibility.catalogEntry.entry.id,
    ).toBe(publishedPayload.catalogEntry.entry.id);
    expect(inspectProgressPayload.progress.progress.completionNote).toBe(
      "Queued follow-up is almost complete",
    );
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.run.id);
    expect(clearProgressPayload.progress.progress.completionNote).toBe(
      "Queued follow-up is almost complete",
    );
    expect(progressedAfterClearPayload.progressed.totalCount).toBe(0);
  });

  it("blocks, lists-blocked, inspects, clears, and reapplies progressed catalog entries through the CLI", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-cli-checklist-blockers-"),
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
    const saveIo = createIo();
    const publishIo = createIo();
    const shareIo = createIo();
    const reviewIo = createIo();
    const assignIo = createIo();
    const checklistIo = createIo();
    const progressIo = createIo();
    const blockerIo = createIo();
    const blockedPeerIo = createIo();
    const inspectBlockerIo = createIo();
    const applyIo = createIo();
    const clearBlockerIo = createIo();
    const blockedAfterClearIo = createIo();

    await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
      workerId: "worker_cli_blocker",
    });
    await worker.processNextJob();

    await runCli(
      [
        "audit",
        "saved-views",
        "save",
        "--name",
        "Queued blocker preset",
        "--description",
        "Saved queued worker blocker preset",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_blocker",
        "--audit-view-run-id",
        queuedRun.run.id,
        "--drilldown-run-id",
        queuedRun.run.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
    const shareExitCode = await runCli(
      ["audit", "catalog", "share", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: shareIo.io,
      },
    );
    const reviewExitCode = await runCli(
      [
        "audit",
        "catalog",
        "review",
        publishedPayload.catalogEntry.entry.id,
        "--state",
        "recommended",
        "--note",
        `Blocker ready after inline ${inlineRun.run.id}`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: reviewIo.io,
      },
    );
    const assignExitCode = await runCli(
      [
        "audit",
        "catalog",
        "assign",
        publishedPayload.catalogEntry.entry.id,
        "--assignee",
        "ops_backup",
        "--handoff-note",
        `Queued worker ${queuedRun.run.id} handed to backup`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: assignIo.io,
      },
    );
    const checklistExitCode = await runCli(
      [
        "audit",
        "catalog",
        "checklist",
        publishedPayload.catalogEntry.entry.id,
        "--status",
        "pending",
        "--items-json",
        JSON.stringify(["Validate queued follow-up", "Close backup handoff"]),
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: checklistIo.io,
      },
    );
    const progressExitCode = await runCli(
      [
        "audit",
        "catalog",
        "progress",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "completed",
          },
          {
            item: "Close backup handoff",
            state: "pending",
          },
        ]),
        "--completion-note",
        "Queued follow-up is almost complete",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: progressIo.io,
      },
    );
    const blockerExitCode = await runCli(
      [
        "audit",
        "catalog",
        "block",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "cleared",
          },
          {
            item: "Close backup handoff",
            state: "blocked",
          },
        ]),
        "--blocker-note",
        "Waiting for the overnight handoff",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: blockerIo.io,
      },
    );
    const blockedPeerExitCode = await runCli(["audit", "catalog", "blocked"], {
      cwd: workspaceRoot,
      env: {
        RUNROOT_OPERATOR_ID: "ops_backup",
        RUNROOT_OPERATOR_SCOPE: "ops",
        RUNROOT_PERSISTENCE_DRIVER: "sqlite",
        RUNROOT_SQLITE_PATH: sqlitePath,
      },
      io: blockedPeerIo.io,
    });
    const inspectBlockerExitCode = await runCli(
      [
        "audit",
        "catalog",
        "inspect-blocker",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inspectBlockerIo.io,
      },
    );
    const applyExitCode = await runCli(
      ["audit", "catalog", "apply", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: applyIo.io,
      },
    );
    const clearBlockerExitCode = await runCli(
      [
        "audit",
        "catalog",
        "clear-blocker",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: clearBlockerIo.io,
      },
    );
    const blockedAfterClearExitCode = await runCli(
      ["audit", "catalog", "blocked"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: blockedAfterClearIo.io,
      },
    );
    const blockerPayload = JSON.parse(blockerIo.stdout.join("")) as {
      blocker: {
        blocker: {
          blockerNote?: string;
          items: Array<{
            item: string;
            state: "blocked" | "cleared";
          }>;
        };
        progress: {
          progress: {
            completionNote?: string;
          };
        };
      };
    };
    const blockedPeerPayload = JSON.parse(blockedPeerIo.stdout.join("")) as {
      blocked: {
        items: Array<{
          progress: {
            checklist: {
              assignment: {
                review: {
                  visibility: {
                    catalogEntry: {
                      entry: {
                        id: string;
                      };
                    };
                  };
                };
              };
            };
          };
        }>;
        totalCount: number;
      };
    };
    const inspectBlockerPayload = JSON.parse(
      inspectBlockerIo.stdout.join(""),
    ) as {
      blocker: {
        blocker: {
          blockerNote?: string;
          items: Array<{
            item: string;
            state: "blocked" | "cleared";
          }>;
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
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearBlockerPayload = JSON.parse(clearBlockerIo.stdout.join("")) as {
      blocker: {
        blocker: {
          blockerNote?: string;
        };
      };
    };
    const blockedAfterClearPayload = JSON.parse(
      blockedAfterClearIo.stdout.join(""),
    ) as {
      blocked: {
        totalCount: number;
      };
    };

    expect(publishExitCode).toBe(0);
    expect(shareExitCode).toBe(0);
    expect(reviewExitCode).toBe(0);
    expect(assignExitCode).toBe(0);
    expect(checklistExitCode).toBe(0);
    expect(progressExitCode).toBe(0);
    expect(blockerExitCode).toBe(0);
    expect(blockedPeerExitCode).toBe(0);
    expect(inspectBlockerExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(clearBlockerExitCode).toBe(0);
    expect(blockedAfterClearExitCode).toBe(0);
    expect(blockerPayload.blocker.progress.progress.completionNote).toBe(
      "Queued follow-up is almost complete",
    );
    expect(blockerPayload.blocker.blocker.blockerNote).toBe(
      "Waiting for the overnight handoff",
    );
    expect(blockerPayload.blocker.blocker.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "cleared",
      },
      {
        item: "Close backup handoff",
        state: "blocked",
      },
    ]);
    expect(blockedPeerPayload.blocked.totalCount).toBe(1);
    expect(
      blockedPeerPayload.blocked.items[0]?.progress.checklist.assignment.review
        .visibility.catalogEntry.entry.id,
    ).toBe(publishedPayload.catalogEntry.entry.id);
    expect(inspectBlockerPayload.blocker.blocker.blockerNote).toBe(
      "Waiting for the overnight handoff",
    );
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.run.id);
    expect(clearBlockerPayload.blocker.blocker.blockerNote).toBe(
      "Waiting for the overnight handoff",
    );
    expect(blockedAfterClearPayload.blocked.totalCount).toBe(0);
  });

  it("resolves, lists-resolved, inspects, clears, and reapplies blocked catalog entries through the CLI", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-cli-checklist-resolutions-"),
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
    const saveIo = createIo();
    const publishIo = createIo();
    const shareIo = createIo();
    const reviewIo = createIo();
    const assignIo = createIo();
    const checklistIo = createIo();
    const progressIo = createIo();
    const blockerIo = createIo();
    const resolutionIo = createIo();
    const resolvedPeerIo = createIo();
    const inspectResolutionIo = createIo();
    const applyIo = createIo();
    const clearResolutionIo = createIo();
    const resolvedAfterClearIo = createIo();

    await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
      workerId: "worker_cli_resolution",
    });
    await worker.processNextJob();

    await runCli(
      [
        "audit",
        "saved-views",
        "save",
        "--name",
        "Queued resolution preset",
        "--description",
        "Saved queued worker resolution preset",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_resolution",
        "--audit-view-run-id",
        queuedRun.run.id,
        "--drilldown-run-id",
        queuedRun.run.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
    const shareExitCode = await runCli(
      ["audit", "catalog", "share", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: shareIo.io,
      },
    );
    const reviewExitCode = await runCli(
      [
        "audit",
        "catalog",
        "review",
        publishedPayload.catalogEntry.entry.id,
        "--state",
        "recommended",
        "--note",
        `Resolution ready after inline ${inlineRun.run.id}`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: reviewIo.io,
      },
    );
    const assignExitCode = await runCli(
      [
        "audit",
        "catalog",
        "assign",
        publishedPayload.catalogEntry.entry.id,
        "--assignee",
        "ops_backup",
        "--handoff-note",
        `Queued worker ${queuedRun.run.id} handed to backup`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: assignIo.io,
      },
    );
    const checklistExitCode = await runCli(
      [
        "audit",
        "catalog",
        "checklist",
        publishedPayload.catalogEntry.entry.id,
        "--status",
        "pending",
        "--items-json",
        JSON.stringify(["Validate queued follow-up", "Close backup handoff"]),
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: checklistIo.io,
      },
    );
    const progressExitCode = await runCli(
      [
        "audit",
        "catalog",
        "progress",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "completed",
          },
          {
            item: "Close backup handoff",
            state: "pending",
          },
        ]),
        "--completion-note",
        "Queued follow-up is almost complete",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: progressIo.io,
      },
    );
    const blockerExitCode = await runCli(
      [
        "audit",
        "catalog",
        "block",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "cleared",
          },
          {
            item: "Close backup handoff",
            state: "blocked",
          },
        ]),
        "--blocker-note",
        "Waiting for the overnight handoff",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: blockerIo.io,
      },
    );
    const resolutionExitCode = await runCli(
      [
        "audit",
        "catalog",
        "resolve",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "resolved",
          },
          {
            item: "Close backup handoff",
            state: "unresolved",
          },
        ]),
        "--resolution-note",
        "Backup confirmed the follow-up closure",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: resolutionIo.io,
      },
    );
    const resolvedPeerExitCode = await runCli(
      ["audit", "catalog", "resolved"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: resolvedPeerIo.io,
      },
    );
    const inspectResolutionExitCode = await runCli(
      [
        "audit",
        "catalog",
        "inspect-resolution",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inspectResolutionIo.io,
      },
    );
    const applyExitCode = await runCli(
      ["audit", "catalog", "apply", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: applyIo.io,
      },
    );
    const clearResolutionExitCode = await runCli(
      [
        "audit",
        "catalog",
        "clear-resolution",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: clearResolutionIo.io,
      },
    );
    const resolvedAfterClearExitCode = await runCli(
      ["audit", "catalog", "resolved"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: resolvedAfterClearIo.io,
      },
    );
    const resolutionPayload = JSON.parse(resolutionIo.stdout.join("")) as {
      resolution: {
        blocker: {
          blocker: {
            blockerNote?: string;
          };
        };
        resolution: {
          items: Array<{
            item: string;
            state: "resolved" | "unresolved";
          }>;
          resolutionNote?: string;
        };
      };
    };
    const resolvedPeerPayload = JSON.parse(resolvedPeerIo.stdout.join("")) as {
      resolved: {
        items: Array<{
          blocker: {
            progress: {
              checklist: {
                assignment: {
                  review: {
                    visibility: {
                      catalogEntry: {
                        entry: {
                          id: string;
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        }>;
        totalCount: number;
      };
    };
    const inspectResolutionPayload = JSON.parse(
      inspectResolutionIo.stdout.join(""),
    ) as {
      resolution: {
        resolution: {
          items: Array<{
            item: string;
            state: "resolved" | "unresolved";
          }>;
          resolutionNote?: string;
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
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearResolutionPayload = JSON.parse(
      clearResolutionIo.stdout.join(""),
    ) as {
      resolution: {
        resolution: {
          resolutionNote?: string;
        };
      };
    };
    const resolvedAfterClearPayload = JSON.parse(
      resolvedAfterClearIo.stdout.join(""),
    ) as {
      resolved: {
        totalCount: number;
      };
    };

    expect(publishExitCode).toBe(0);
    expect(shareExitCode).toBe(0);
    expect(reviewExitCode).toBe(0);
    expect(assignExitCode).toBe(0);
    expect(checklistExitCode).toBe(0);
    expect(progressExitCode).toBe(0);
    expect(blockerExitCode).toBe(0);
    expect(resolutionExitCode).toBe(0);
    expect(resolvedPeerExitCode).toBe(0);
    expect(inspectResolutionExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(clearResolutionExitCode).toBe(0);
    expect(resolvedAfterClearExitCode).toBe(0);
    expect(resolutionPayload.resolution.blocker.blocker.blockerNote).toBe(
      "Waiting for the overnight handoff",
    );
    expect(resolutionPayload.resolution.resolution.resolutionNote).toBe(
      "Backup confirmed the follow-up closure",
    );
    expect(resolutionPayload.resolution.resolution.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "resolved",
      },
      {
        item: "Close backup handoff",
        state: "unresolved",
      },
    ]);
    expect(resolvedPeerPayload.resolved.totalCount).toBe(1);
    expect(
      resolvedPeerPayload.resolved.items[0]?.blocker.progress.checklist
        .assignment.review.visibility.catalogEntry.entry.id,
    ).toBe(publishedPayload.catalogEntry.entry.id);
    expect(inspectResolutionPayload.resolution.resolution.resolutionNote).toBe(
      "Backup confirmed the follow-up closure",
    );
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.run.id);
    expect(clearResolutionPayload.resolution.resolution.resolutionNote).toBe(
      "Backup confirmed the follow-up closure",
    );
    expect(resolvedAfterClearPayload.resolved.totalCount).toBe(0);
  });

  it("verifies, lists-verified, inspects, clears, and reapplies resolved catalog entries through the CLI", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-cli-checklist-verifications-"),
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
    const saveIo = createIo();
    const publishIo = createIo();
    const shareIo = createIo();
    const reviewIo = createIo();
    const assignIo = createIo();
    const checklistIo = createIo();
    const progressIo = createIo();
    const blockerIo = createIo();
    const resolutionIo = createIo();
    const verificationIo = createIo();
    const verifiedPeerIo = createIo();
    const inspectVerificationIo = createIo();
    const applyIo = createIo();
    const clearVerificationIo = createIo();
    const verifiedAfterClearIo = createIo();

    await runCli(
      ["runs", "start", "shell-runbook-flow", "--input-file", inputFile],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
      workerId: "worker_cli_verification",
    });
    await worker.processNextJob();

    await runCli(
      [
        "audit",
        "saved-views",
        "save",
        "--name",
        "Queued verification preset",
        "--description",
        "Saved queued worker verification preset",
        "--execution-mode",
        "queued",
        "--worker-id",
        "worker_cli_verification",
        "--audit-view-run-id",
        queuedRun.run.id,
        "--drilldown-run-id",
        queuedRun.run.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
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
    const shareExitCode = await runCli(
      ["audit", "catalog", "share", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: shareIo.io,
      },
    );
    const reviewExitCode = await runCli(
      [
        "audit",
        "catalog",
        "review",
        publishedPayload.catalogEntry.entry.id,
        "--state",
        "recommended",
        "--note",
        `Verification ready after inline ${inlineRun.run.id}`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: reviewIo.io,
      },
    );
    const assignExitCode = await runCli(
      [
        "audit",
        "catalog",
        "assign",
        publishedPayload.catalogEntry.entry.id,
        "--assignee",
        "ops_backup",
        "--handoff-note",
        `Queued worker ${queuedRun.run.id} handed to backup`,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: assignIo.io,
      },
    );
    const checklistExitCode = await runCli(
      [
        "audit",
        "catalog",
        "checklist",
        publishedPayload.catalogEntry.entry.id,
        "--status",
        "pending",
        "--items-json",
        JSON.stringify(["Validate queued follow-up", "Close backup handoff"]),
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: checklistIo.io,
      },
    );
    const progressExitCode = await runCli(
      [
        "audit",
        "catalog",
        "progress",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "completed",
          },
          {
            item: "Close backup handoff",
            state: "pending",
          },
        ]),
        "--completion-note",
        "Queued follow-up is almost complete",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: progressIo.io,
      },
    );
    const blockerExitCode = await runCli(
      [
        "audit",
        "catalog",
        "block",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "cleared",
          },
          {
            item: "Close backup handoff",
            state: "blocked",
          },
        ]),
        "--blocker-note",
        "Waiting for the overnight handoff",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: blockerIo.io,
      },
    );
    const resolutionExitCode = await runCli(
      [
        "audit",
        "catalog",
        "resolve",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "resolved",
          },
          {
            item: "Close backup handoff",
            state: "unresolved",
          },
        ]),
        "--resolution-note",
        "Backup confirmed the follow-up closure",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: resolutionIo.io,
      },
    );
    const verificationExitCode = await runCli(
      [
        "audit",
        "catalog",
        "verify",
        publishedPayload.catalogEntry.entry.id,
        "--items-json",
        JSON.stringify([
          {
            item: "Validate queued follow-up",
            state: "verified",
          },
          {
            item: "Close backup handoff",
            state: "unverified",
          },
        ]),
        "--verification-note",
        "Backup verified the follow-up closure",
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: verificationIo.io,
      },
    );
    const verifiedPeerExitCode = await runCli(
      ["audit", "catalog", "verified"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: verifiedPeerIo.io,
      },
    );
    const inspectVerificationExitCode = await runCli(
      [
        "audit",
        "catalog",
        "inspect-verification",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: inspectVerificationIo.io,
      },
    );
    const applyExitCode = await runCli(
      ["audit", "catalog", "apply", publishedPayload.catalogEntry.entry.id],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: applyIo.io,
      },
    );
    const clearVerificationExitCode = await runCli(
      [
        "audit",
        "catalog",
        "clear-verification",
        publishedPayload.catalogEntry.entry.id,
      ],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_oncall",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: clearVerificationIo.io,
      },
    );
    const verifiedAfterClearExitCode = await runCli(
      ["audit", "catalog", "verified"],
      {
        cwd: workspaceRoot,
        env: {
          RUNROOT_OPERATOR_ID: "ops_backup",
          RUNROOT_OPERATOR_SCOPE: "ops",
          RUNROOT_PERSISTENCE_DRIVER: "sqlite",
          RUNROOT_SQLITE_PATH: sqlitePath,
        },
        io: verifiedAfterClearIo.io,
      },
    );
    const verificationPayload = JSON.parse(verificationIo.stdout.join("")) as {
      verification: {
        resolution: {
          resolution: {
            resolutionNote?: string;
          };
        };
        verification: {
          items: Array<{
            item: string;
            state: "verified" | "unverified";
          }>;
          verificationNote?: string;
        };
      };
    };
    const verifiedPeerPayload = JSON.parse(verifiedPeerIo.stdout.join("")) as {
      verified: {
        items: Array<{
          resolution: {
            blocker: {
              progress: {
                checklist: {
                  assignment: {
                    review: {
                      visibility: {
                        catalogEntry: {
                          entry: {
                            id: string;
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        }>;
        totalCount: number;
      };
    };
    const inspectVerificationPayload = JSON.parse(
      inspectVerificationIo.stdout.join(""),
    ) as {
      verification: {
        verification: {
          items: Array<{
            item: string;
            state: "verified" | "unverified";
          }>;
          verificationNote?: string;
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
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearVerificationPayload = JSON.parse(
      clearVerificationIo.stdout.join(""),
    ) as {
      verification: {
        verification: {
          verificationNote?: string;
        };
      };
    };
    const verifiedAfterClearPayload = JSON.parse(
      verifiedAfterClearIo.stdout.join(""),
    ) as {
      verified: {
        totalCount: number;
      };
    };

    expect(publishExitCode).toBe(0);
    expect(shareExitCode).toBe(0);
    expect(reviewExitCode).toBe(0);
    expect(assignExitCode).toBe(0);
    expect(checklistExitCode).toBe(0);
    expect(progressExitCode).toBe(0);
    expect(blockerExitCode).toBe(0);
    expect(resolutionExitCode).toBe(0);
    expect(verificationExitCode).toBe(0);
    expect(verifiedPeerExitCode).toBe(0);
    expect(inspectVerificationExitCode).toBe(0);
    expect(applyExitCode).toBe(0);
    expect(clearVerificationExitCode).toBe(0);
    expect(verifiedAfterClearExitCode).toBe(0);
    expect(
      verificationPayload.verification.resolution.resolution.resolutionNote,
    ).toBe("Backup confirmed the follow-up closure");
    expect(verificationPayload.verification.verification.verificationNote).toBe(
      "Backup verified the follow-up closure",
    );
    expect(verificationPayload.verification.verification.items).toEqual([
      {
        item: "Validate queued follow-up",
        state: "verified",
      },
      {
        item: "Close backup handoff",
        state: "unverified",
      },
    ]);
    expect(verifiedPeerPayload.verified.totalCount).toBe(1);
    expect(
      verifiedPeerPayload.verified.items[0]?.resolution.blocker.progress
        .checklist.assignment.review.visibility.catalogEntry.entry.id,
    ).toBe(publishedPayload.catalogEntry.entry.id);
    expect(
      inspectVerificationPayload.verification.verification.verificationNote,
    ).toBe("Backup verified the follow-up closure");
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(queuedRun.run.id);
    expect(
      clearVerificationPayload.verification.verification.verificationNote,
    ).toBe("Backup verified the follow-up closure");
    expect(verifiedAfterClearPayload.verified.totalCount).toBe(0);
  });
});
