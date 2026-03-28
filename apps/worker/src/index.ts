import { createRunrootWorkerService } from "@runroot/sdk";

const pollIntervalMs = readPositiveInteger(
  process.env.RUNROOT_WORKER_POLL_INTERVAL_MS,
  250,
);
const workerId = process.env.RUNROOT_WORKER_ID ?? "runroot-worker-local";
const worker = createRunrootWorkerService({
  env: process.env,
  workerId,
});
let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
  emitWorkerLog("info", "worker received SIGINT", {
    workerId,
  });
});

process.on("SIGTERM", () => {
  stopping = true;
  emitWorkerLog("info", "worker received SIGTERM", {
    workerId,
  });
});

emitWorkerLog("info", "worker started", {
  pollIntervalMs,
  workerId,
});

void run().catch((error) => {
  emitWorkerLog("error", "worker loop crashed", {
    error: error instanceof Error ? error.message : String(error),
    workerId,
  });
  process.exitCode = 1;
});

async function run(): Promise<void> {
  while (!stopping) {
    const result = await worker.processNextJob();

    if (!result) {
      await delay(pollIntervalMs);
      continue;
    }

    emitWorkerLog(
      result.status === "completed" ? "info" : "error",
      "worker processed queued job",
      {
        jobId: result.job.id,
        jobKind: result.job.kind,
        runId: result.job.runId,
        status: result.status,
        ...(result.error ? { error: result.error } : {}),
        ...(result.run ? { runStatus: result.run.status } : {}),
        workerId,
      },
    );
  }
}

function emitWorkerLog(
  level: "error" | "info",
  message: string,
  attributes: Readonly<Record<string, string | number>>,
): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        attributes,
        level,
        message,
        surface: "worker",
      },
      null,
      2,
    )}\n`,
  );
}

function readPositiveInteger(
  rawValue: string | undefined,
  fallback: number,
): number {
  const parsedValue = Number.parseInt(rawValue ?? "", 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, durationMs);
  });
}
