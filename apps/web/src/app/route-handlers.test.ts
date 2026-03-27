import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as decideApproval } from "./approvals/[approvalId]/decision/route";
import { POST as resumeRun } from "./runs/[runId]/resume/route";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("@runroot/web route handlers", () => {
  it("redirects back to the approval queue after a successful decision", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          approval: {
            id: "approval_1",
            requestedAt: "2026-03-27T18:00:00.000Z",
            runId: "run_1",
            status: "approved",
          },
        }),
        {
          status: 200,
        },
      ),
    ) as typeof fetch;

    const formData = new FormData();
    formData.set("decision", "approved");
    formData.set("returnTo", "/approvals");

    const response = await decideApproval(
      new Request("http://localhost/approvals/approval_1/decision", {
        body: formData,
        method: "POST",
      }),
      {
        params: Promise.resolve({
          approvalId: "approval_1",
        }),
      },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain(
      "/approvals?notice=Approval+approval_1+marked+as+approved.",
    );
  });

  it("redirects back to the run detail after a successful resume", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          run: {
            createdAt: "2026-03-27T18:00:00.000Z",
            currentStepIndex: 1,
            definitionId: "slack-approval-flow",
            definitionName: "Slack approval flow",
            definitionVersion: "0.0.0",
            id: "run_1",
            metadata: {},
            status: "succeeded",
            updatedAt: "2026-03-27T18:05:00.000Z",
          },
        }),
        {
          status: 200,
        },
      ),
    ) as typeof fetch;

    const formData = new FormData();
    formData.set("returnTo", "/runs/run_1");

    const response = await resumeRun(
      new Request("http://localhost/runs/run_1/resume", {
        body: formData,
        method: "POST",
      }),
      {
        params: Promise.resolve({
          runId: "run_1",
        }),
      },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain(
      "/runs/run_1?notice=Run+run_1+resumed.",
    );
  });
});
