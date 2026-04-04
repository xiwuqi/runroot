import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createRunrootOperatorService } from "@runroot/sdk";
import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "./server";

let app = buildServer();

afterEach(async () => {
  await app.close();
});

describe("@runroot/api", () => {
  it("returns the current health state", async () => {
    app = buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/healthz",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      project: "Runroot",
      phase: 28,
    });
  });

  it("returns package manifest integrity data", async () => {
    app = buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/manifest/packages",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();

    expect(payload.packages.length).toBeGreaterThan(5);
    expect(payload.integrity.duplicateNames).toEqual([]);
  });

  it("starts a template run and exposes its replay timeline", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
        status: string;
      };
    };

    const runResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdPayload.run.id}`,
    });
    const timelineResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdPayload.run.id}/timeline`,
    });
    const timelinePayload = timelineResponse.json() as {
      timeline: {
        entries: Array<{
          kind: string;
        }>;
      };
    };

    expect(createResponse.statusCode).toBe(201);
    expect(runResponse.statusCode).toBe(200);
    expect(createdPayload.run.status).toBe("succeeded");
    expect(
      timelinePayload.timeline.entries.map((entry) => entry.kind),
    ).toContain("run-succeeded");
  });

  it("exposes persisted tool history through the operator API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-tools-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const toolHistoryResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdPayload.run.id}/tool-history`,
    });
    const toolHistoryPayload = toolHistoryResponse.json() as {
      entries: Array<{
        executionMode?: string;
        outcome: string;
        toolName: string;
      }>;
    };

    expect(toolHistoryResponse.statusCode).toBe(200);
    expect(toolHistoryPayload.entries.map((entry) => entry.toolName)).toEqual([
      "shell.runbook",
      "shell.runbook",
    ]);
    expect(
      toolHistoryPayload.entries.every(
        (entry) =>
          entry.executionMode === "inline" && entry.outcome === "succeeded",
      ),
    ).toBe(true);
  });

  it("exposes correlated audit views through the operator API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-audit-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const auditResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdPayload.run.id}/audit`,
    });
    const auditPayload = auditResponse.json() as {
      audit: {
        entries: Array<{
          correlation: {
            runId: string;
            toolCallId?: string;
          };
          fact: {
            sourceOfTruth: string;
          };
          kind: string;
        }>;
      };
    };

    expect(auditResponse.statusCode).toBe(200);
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
          entry.fact.sourceOfTruth === "tool-history" &&
          entry.correlation.runId === createdPayload.run.id &&
          typeof entry.correlation.toolCallId === "string",
      ),
    ).toBe(true);
  });

  it("exposes cross-run audit drilldowns through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-drilldown-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const drilldownResponse = await app.inject({
      method: "GET",
      url: `/audit/drilldowns?runId=${createdPayload.run.id}`,
    });
    const drilldownPayload = drilldownResponse.json() as {
      audit: {
        isConstrained: boolean;
        results: Array<{
          matchedEntryCount: number;
          runId: string;
        }>;
        totalCount: number;
      };
    };

    expect(drilldownResponse.statusCode).toBe(200);
    expect(drilldownPayload.audit.isConstrained).toBe(true);
    expect(drilldownPayload.audit.totalCount).toBe(1);
    expect(drilldownPayload.audit.results[0]).toMatchObject({
      matchedEntryCount: expect.any(Number),
      runId: createdPayload.run.id,
    });
  });

  it("exposes linked audit navigation through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-navigation-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const navigationResponse = await app.inject({
      method: "GET",
      url: `/audit/navigation?runId=${createdPayload.run.id}`,
    });
    const navigationPayload = navigationResponse.json() as {
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
            auditView: {
              kind: string;
              runId: string;
            };
            drilldowns: Array<{
              filters: {
                runId?: string;
              };
            }>;
          };
          result: {
            runId: string;
          };
        }>;
        totalSummaryCount: number;
      };
    };

    expect(navigationResponse.statusCode).toBe(200);
    expect(navigationPayload.audit.isConstrained).toBe(true);
    expect(navigationPayload.audit.totalSummaryCount).toBe(1);
    expect(navigationPayload.audit.summaries[0]?.links.auditView).toMatchObject(
      {
        kind: "run-audit-view",
        runId: createdPayload.run.id,
      },
    );
    expect(
      navigationPayload.audit.summaries[0]?.links.drilldowns.some(
        (link) => link.filters.runId === createdPayload.run.id,
      ),
    ).toBe(true);
    expect(navigationPayload.audit.drilldowns[0]).toMatchObject({
      links: {
        auditView: {
          kind: "run-audit-view",
          runId: createdPayload.run.id,
        },
      },
      result: {
        runId: createdPayload.run.id,
      },
    });
  });

  it("saves, lists, loads, and applies saved audit views through the operator API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-saved-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        savedViewIdGenerator: () => "saved_view_api",
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Saved run detail",
        navigation: {
          drilldown: {
            runId: createdPayload.run.id,
          },
          summary: {
            definitionId: "shell-runbook-flow",
          },
        },
        refs: {
          auditViewRunId: createdPayload.run.id,
        },
      },
      url: "/audit/saved-views",
    });
    const savedViewPayload = saveResponse.json() as {
      savedView: {
        id: string;
      };
    };
    const listResponse = await app.inject({
      method: "GET",
      url: "/audit/saved-views",
    });
    const listPayload = listResponse.json() as {
      savedViews: {
        items: Array<{
          id: string;
        }>;
        totalCount: number;
      };
    };
    const getResponse = await app.inject({
      method: "GET",
      url: `/audit/saved-views/${savedViewPayload.savedView.id}`,
    });
    const applyResponse = await app.inject({
      method: "GET",
      url: `/audit/saved-views/${savedViewPayload.savedView.id}/apply`,
    });
    const applyPayload = applyResponse.json() as {
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

    expect(saveResponse.statusCode).toBe(201);
    expect(savedViewPayload.savedView.id).toBe("saved_view_api");
    expect(listResponse.statusCode).toBe(200);
    expect(listPayload.savedViews.totalCount).toBe(1);
    expect(listPayload.savedViews.items[0]?.id).toBe("saved_view_api");
    expect(getResponse.statusCode).toBe(200);
    expect(applyResponse.statusCode).toBe(200);
    expect(applyPayload.application.savedView.id).toBe("saved_view_api");
    expect(applyPayload.application.navigation.totalSummaryCount).toBe(1);
    expect(
      applyPayload.application.navigation.drilldowns[0]?.result.runId,
    ).toBe(createdPayload.run.id);
  });

  it("rejects refs-only saved audit views through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-saved-invalid-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Refs only",
        refs: {
          auditViewRunId: "run_queued",
          drilldownRunId: "run_queued",
        },
      },
      url: "/audit/saved-views",
    });

    expect(saveResponse.statusCode).toBe(400);
    expect(saveResponse.body).toContain(
      "Saved audit views require at least one stable summary or drilldown filter",
    );
  });

  it("publishes, shares, lists, inspects, unshares, archives, and applies audit view catalog entries through the operator API", async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), "runroot-api-catalog-"));
    app = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_api",
        savedViewIdGenerator: () => "saved_view_api",
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Saved run detail",
        navigation: {
          drilldown: {
            runId: createdPayload.run.id,
          },
          summary: {
            definitionId: "shell-runbook-flow",
          },
        },
        refs: {
          auditViewRunId: createdPayload.run.id,
        },
      },
      url: "/audit/saved-views",
    });
    const savedViewPayload = saveResponse.json() as {
      savedView: {
        id: string;
      };
    };
    const publishResponse = await app.inject({
      method: "POST",
      payload: {
        savedViewId: savedViewPayload.savedView.id,
      },
      url: "/audit/catalog",
    });
    const publishedPayload = publishResponse.json() as {
      catalogEntry: {
        entry: {
          id: string;
        };
      };
    };
    const listResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog",
    });
    const visibleResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/visible",
    });
    const listPayload = listResponse.json() as {
      catalog: {
        items: Array<{
          entry: {
            id: string;
          };
        }>;
        totalCount: number;
      };
    };
    const visiblePayload = visibleResponse.json() as {
      visibility: {
        items: Array<{
          visibility: {
            state: "personal" | "shared";
          };
        }>;
        totalCount: number;
      };
    };
    const inspectResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/visibility`,
    });
    const shareResponse = await app.inject({
      method: "POST",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
    });
    const getResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}`,
    });
    const applyResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
    });
    const unshareResponse = await app.inject({
      method: "POST",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/unshare`,
    });
    const archiveResponse = await app.inject({
      method: "POST",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/archive`,
    });
    const listArchivedResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog",
    });
    const applyPayload = applyResponse.json() as {
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
        catalogEntry: {
          entry: {
            id: string;
          };
        };
      };
    };
    const archivePayload = archiveResponse.json() as {
      catalogEntry: {
        entry: {
          archivedAt?: string;
        };
      };
    };
    const inspectPayload = inspectResponse.json() as {
      visibility: {
        visibility: {
          state: "personal" | "shared";
        };
      };
    };
    const sharePayload = shareResponse.json() as {
      visibility: {
        visibility: {
          scopeId: string;
          state: "personal" | "shared";
        };
      };
    };
    const unsharePayload = unshareResponse.json() as {
      visibility: {
        visibility: {
          ownerId: string;
          state: "personal" | "shared";
        };
      };
    };
    const archivedListPayload = listArchivedResponse.json() as {
      catalog: {
        totalCount: number;
      };
    };

    expect(publishResponse.statusCode).toBe(201);
    expect(publishedPayload.catalogEntry.entry.id).toBe("catalog_entry_api");
    expect(listResponse.statusCode).toBe(200);
    expect(visibleResponse.statusCode).toBe(200);
    expect(listPayload.catalog.totalCount).toBe(1);
    expect(listPayload.catalog.items[0]?.entry.id).toBe("catalog_entry_api");
    expect(visiblePayload.visibility.totalCount).toBe(1);
    expect(visiblePayload.visibility.items[0]?.visibility.state).toBe(
      "personal",
    );
    expect(inspectResponse.statusCode).toBe(200);
    expect(inspectPayload.visibility.visibility.state).toBe("personal");
    expect(shareResponse.statusCode).toBe(200);
    expect(sharePayload.visibility.visibility.state).toBe("shared");
    expect(sharePayload.visibility.visibility.scopeId).toBe("workspace");
    expect(getResponse.statusCode).toBe(200);
    expect(applyResponse.statusCode).toBe(200);
    expect(applyPayload.application.catalogEntry.entry.id).toBe(
      "catalog_entry_api",
    );
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(
      applyPayload.application.application.navigation.totalSummaryCount,
    ).toBe(1);
    expect(
      applyPayload.application.application.navigation.drilldowns[0]?.result
        .runId,
    ).toBe(createdPayload.run.id);
    expect(unshareResponse.statusCode).toBe(200);
    expect(unsharePayload.visibility.visibility.state).toBe("personal");
    expect(unsharePayload.visibility.visibility.ownerId).toBe("operator");
    expect(archiveResponse.statusCode).toBe(200);
    expect(archivePayload.catalogEntry.entry.archivedAt).toBeTruthy();
    expect(listArchivedResponse.statusCode).toBe(200);
    expect(archivedListPayload.catalog.totalCount).toBe(0);
  });

  it("reviews, lists-reviewed, inspects, clears, and reuses reviewed catalog entries through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-review-signals-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_review_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        savedViewIdGenerator: () => "saved_view_review_api",
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Saved run detail",
        navigation: {
          drilldown: {
            runId: createdPayload.run.id,
          },
          summary: {
            definitionId: "shell-runbook-flow",
          },
        },
        refs: {
          auditViewRunId: createdPayload.run.id,
        },
      },
      url: "/audit/saved-views",
    });
    const savedViewPayload = saveResponse.json() as {
      savedView: {
        id: string;
      };
    };
    const publishResponse = await app.inject({
      method: "POST",
      payload: {
        savedViewId: savedViewPayload.savedView.id,
      },
      url: "/audit/catalog",
    });
    const publishedPayload = publishResponse.json() as {
      catalogEntry: {
        entry: {
          id: string;
        };
      };
    };
    const shareResponse = await app.inject({
      method: "POST",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/share`,
    });
    const reviewResponse = await app.inject({
      method: "POST",
      payload: {
        note: "Recommended for shared on-call follow-up",
        state: "recommended",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
    });
    const reviewedListResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/reviewed",
    });
    const inspectReviewResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
    });
    const applyResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
    });
    const clearReviewResponse = await app.inject({
      method: "POST",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review/clear`,
    });
    const reviewedAfterClearResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/reviewed",
    });
    const sharePayload = shareResponse.json() as {
      visibility: {
        visibility: {
          state: "shared";
        };
      };
    };
    const reviewPayload = reviewResponse.json() as {
      review: {
        review: {
          note?: string;
          state: "recommended" | "reviewed";
        };
      };
    };
    const reviewedListPayload = reviewedListResponse.json() as {
      reviewed: {
        items: Array<{
          review: {
            state: "recommended" | "reviewed";
          };
          visibility: {
            catalogEntry: {
              entry: {
                id: string;
              };
            };
          };
        }>;
        totalCount: number;
      };
    };
    const inspectReviewPayload = inspectReviewResponse.json() as {
      review: {
        review: {
          note?: string;
          state: "recommended" | "reviewed";
        };
      };
    };
    const applyPayload = applyResponse.json() as {
      application: {
        application: {
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearReviewPayload = clearReviewResponse.json() as {
      review: {
        review: {
          state: "recommended" | "reviewed";
        };
      };
    };
    const reviewedAfterClearPayload = reviewedAfterClearResponse.json() as {
      reviewed: {
        totalCount: number;
      };
    };

    expect(shareResponse.statusCode).toBe(200);
    expect(sharePayload.visibility.visibility.state).toBe("shared");
    expect(reviewResponse.statusCode).toBe(200);
    expect(reviewPayload.review.review.state).toBe("recommended");
    expect(reviewPayload.review.review.note).toContain("shared on-call");
    expect(reviewedListResponse.statusCode).toBe(200);
    expect(reviewedListPayload.reviewed.totalCount).toBe(1);
    expect(
      reviewedListPayload.reviewed.items[0]?.visibility.catalogEntry.entry.id,
    ).toBe("catalog_entry_review_api");
    expect(inspectReviewResponse.statusCode).toBe(200);
    expect(inspectReviewPayload.review.review.note).toContain("shared on-call");
    expect(applyResponse.statusCode).toBe(200);
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(clearReviewResponse.statusCode).toBe(200);
    expect(clearReviewPayload.review.review.state).toBe("recommended");
    expect(reviewedAfterClearResponse.statusCode).toBe(200);
    expect(reviewedAfterClearPayload.reviewed.totalCount).toBe(0);
  });

  it("checklists, lists-checklisted, inspects, clears, and reapplies assigned catalog entries through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-checklists-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_checklist_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        savedViewIdGenerator: () => "saved_view_checklist_api",
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Saved checklist detail",
        navigation: {
          drilldown: {
            runId: createdPayload.run.id,
          },
          summary: {
            definitionId: "shell-runbook-flow",
          },
        },
        refs: {
          auditViewRunId: createdPayload.run.id,
        },
      },
      url: "/audit/saved-views",
    });
    const savedViewPayload = saveResponse.json() as {
      savedView: {
        id: string;
      };
    };
    const publishResponse = await app.inject({
      method: "POST",
      payload: {
        savedViewId: savedViewPayload.savedView.id,
      },
      url: "/audit/catalog",
    });
    const publishedPayload = publishResponse.json() as {
      catalogEntry: {
        entry: {
          id: string;
        };
      };
    };
    const reviewResponse = await app.inject({
      method: "POST",
      payload: {
        note: "Checklist-ready inline follow-up",
        state: "reviewed",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
    });
    const assignmentResponse = await app.inject({
      method: "POST",
      payload: {
        assigneeId: "ops_oncall",
        handoffNote: "Inline checklist remains with the owner",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
    });
    const checklistResponse = await app.inject({
      method: "POST",
      payload: {
        items: ["Confirm inline handoff", "Close follow-up"],
        state: "pending",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
    });
    const checklistedResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/checklisted",
    });
    const inspectResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
    });
    const applyResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
    });
    const clearResponse = await app.inject({
      method: "POST",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist/clear`,
    });
    const checklistedAfterClearResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/checklisted",
    });
    const checklistPayload = checklistResponse.json() as {
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
    const checklistedPayload = checklistedResponse.json() as {
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
    const inspectPayload = inspectResponse.json() as {
      checklist: {
        checklist: {
          items?: readonly string[];
          state: "completed" | "pending";
        };
      };
    };
    const applyPayload = applyResponse.json() as {
      application: {
        application: {
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearPayload = clearResponse.json() as {
      checklist: {
        checklist: {
          state: "completed" | "pending";
        };
      };
    };
    const checklistedAfterClearPayload =
      checklistedAfterClearResponse.json() as {
        checklisted: {
          totalCount: number;
        };
      };

    expect(reviewResponse.statusCode).toBe(200);
    expect(assignmentResponse.statusCode).toBe(200);
    expect(checklistResponse.statusCode).toBe(200);
    expect(checklistPayload.checklist.assignment.assignment.assigneeId).toBe(
      "ops_oncall",
    );
    expect(checklistPayload.checklist.checklist.state).toBe("pending");
    expect(checklistPayload.checklist.checklist.items).toEqual([
      "Confirm inline handoff",
      "Close follow-up",
    ]);
    expect(checklistedResponse.statusCode).toBe(200);
    expect(checklistedPayload.checklisted.totalCount).toBe(1);
    expect(
      checklistedPayload.checklisted.items[0]?.assignment.review.visibility
        .catalogEntry.entry.id,
    ).toBe("catalog_entry_checklist_api");
    expect(checklistedPayload.checklisted.items[0]?.checklist.state).toBe(
      "pending",
    );
    expect(inspectResponse.statusCode).toBe(200);
    expect(inspectPayload.checklist.checklist.items).toEqual([
      "Confirm inline handoff",
      "Close follow-up",
    ]);
    expect(applyResponse.statusCode).toBe(200);
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(clearResponse.statusCode).toBe(200);
    expect(clearPayload.checklist.checklist.state).toBe("pending");
    expect(checklistedAfterClearResponse.statusCode).toBe(200);
    expect(checklistedAfterClearPayload.checklisted.totalCount).toBe(0);
  });

  it("progresses, lists-progressed, inspects, clears, and reapplies checklisted catalog entries through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-progress-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_progress_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        savedViewIdGenerator: () => "saved_view_progress_api",
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Saved progress detail",
        navigation: {
          drilldown: {
            runId: createdPayload.run.id,
          },
          summary: {
            definitionId: "shell-runbook-flow",
          },
        },
        refs: {
          auditViewRunId: createdPayload.run.id,
        },
      },
      url: "/audit/saved-views",
    });
    const savedViewPayload = saveResponse.json() as {
      savedView: {
        id: string;
      };
    };
    const publishResponse = await app.inject({
      method: "POST",
      payload: {
        savedViewId: savedViewPayload.savedView.id,
      },
      url: "/audit/catalog",
    });
    const publishedPayload = publishResponse.json() as {
      catalogEntry: {
        entry: {
          id: string;
        };
      };
    };
    const reviewResponse = await app.inject({
      method: "POST",
      payload: {
        note: "Progress-ready inline follow-up",
        state: "reviewed",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
    });
    const assignmentResponse = await app.inject({
      method: "POST",
      payload: {
        assigneeId: "ops_oncall",
        handoffNote: "Inline progress remains with the owner",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
    });
    const checklistResponse = await app.inject({
      method: "POST",
      payload: {
        items: ["Confirm inline handoff", "Close follow-up"],
        state: "pending",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
    });
    const progressResponse = await app.inject({
      method: "POST",
      payload: {
        completionNote: "Inline follow-up is nearly done",
        items: [
          {
            item: "Confirm inline handoff",
            state: "completed",
          },
          {
            item: "Close follow-up",
            state: "pending",
          },
        ],
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
    });
    const progressedResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/progressed",
    });
    const inspectResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
    });
    const applyResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
    });
    const clearResponse = await app.inject({
      method: "POST",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress/clear`,
    });
    const progressedAfterClearResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/progressed",
    });
    const progressPayload = progressResponse.json() as {
      progress: {
        checklist: {
          assignment: {
            assignment: {
              assigneeId: string;
            };
          };
        };
        progress: {
          completionNote?: string;
          items: Array<{
            item: string;
            state: "completed" | "pending";
          }>;
        };
      };
    };
    const progressedPayload = progressedResponse.json() as {
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
          progress: {
            completionNote?: string;
          };
        }>;
        totalCount: number;
      };
    };
    const inspectPayload = inspectResponse.json() as {
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
    const applyPayload = applyResponse.json() as {
      application: {
        application: {
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearPayload = clearResponse.json() as {
      progress: {
        progress: {
          completionNote?: string;
        };
      };
    };
    const progressedAfterClearPayload = progressedAfterClearResponse.json() as {
      progressed: {
        totalCount: number;
      };
    };

    expect(createResponse.statusCode).toBe(201);
    expect(reviewResponse.statusCode).toBe(200);
    expect(assignmentResponse.statusCode).toBe(200);
    expect(checklistResponse.statusCode).toBe(200);
    expect(progressResponse.statusCode).toBe(200);
    expect(
      progressPayload.progress.checklist.assignment.assignment.assigneeId,
    ).toBe("ops_oncall");
    expect(progressPayload.progress.progress.completionNote).toBe(
      "Inline follow-up is nearly done",
    );
    expect(progressPayload.progress.progress.items).toEqual([
      {
        item: "Confirm inline handoff",
        state: "completed",
      },
      {
        item: "Close follow-up",
        state: "pending",
      },
    ]);
    expect(progressedResponse.statusCode).toBe(200);
    expect(progressedPayload.progressed.totalCount).toBe(1);
    expect(
      progressedPayload.progressed.items[0]?.checklist.assignment.review
        .visibility.catalogEntry.entry.id,
    ).toBe("catalog_entry_progress_api");
    expect(inspectResponse.statusCode).toBe(200);
    expect(inspectPayload.progress.progress.completionNote).toBe(
      "Inline follow-up is nearly done",
    );
    expect(inspectPayload.progress.progress.items).toEqual([
      {
        item: "Confirm inline handoff",
        state: "completed",
      },
      {
        item: "Close follow-up",
        state: "pending",
      },
    ]);
    expect(applyResponse.statusCode).toBe(200);
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(clearResponse.statusCode).toBe(200);
    expect(clearPayload.progress.progress.completionNote).toBe(
      "Inline follow-up is nearly done",
    );
    expect(progressedAfterClearResponse.statusCode).toBe(200);
    expect(progressedAfterClearPayload.progressed.totalCount).toBe(0);
  });

  it("blocks, lists-blocked, inspects, clears, and reapplies progressed catalog entries through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-blockers-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_blocker_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        savedViewIdGenerator: () => "saved_view_blocker_api",
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Saved blocker detail",
        navigation: {
          drilldown: {
            runId: createdPayload.run.id,
          },
          summary: {
            definitionId: "shell-runbook-flow",
          },
        },
        refs: {
          auditViewRunId: createdPayload.run.id,
        },
      },
      url: "/audit/saved-views",
    });
    const savedViewPayload = saveResponse.json() as {
      savedView: {
        id: string;
      };
    };
    const publishResponse = await app.inject({
      method: "POST",
      payload: {
        savedViewId: savedViewPayload.savedView.id,
      },
      url: "/audit/catalog",
    });
    const publishedPayload = publishResponse.json() as {
      catalogEntry: {
        entry: {
          id: string;
        };
      };
    };
    const reviewResponse = await app.inject({
      method: "POST",
      payload: {
        note: "Blocker-ready inline follow-up",
        state: "reviewed",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
    });
    const assignmentResponse = await app.inject({
      method: "POST",
      payload: {
        assigneeId: "ops_oncall",
        handoffNote: "Inline blockers remain with the owner",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
    });
    const checklistResponse = await app.inject({
      method: "POST",
      payload: {
        items: ["Confirm inline handoff", "Close follow-up"],
        state: "pending",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
    });
    const progressResponse = await app.inject({
      method: "POST",
      payload: {
        completionNote: "Inline blocker follow-up is underway",
        items: [
          {
            item: "Confirm inline handoff",
            state: "completed",
          },
          {
            item: "Close follow-up",
            state: "pending",
          },
        ],
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
    });
    const blockerResponse = await app.inject({
      method: "POST",
      payload: {
        blockerNote: "Waiting for overnight confirmation",
        items: [
          {
            item: "Confirm inline handoff",
            state: "cleared",
          },
          {
            item: "Close follow-up",
            state: "blocked",
          },
        ],
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker`,
    });
    const blockedResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/blocked",
    });
    const inspectResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker`,
    });
    const applyResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
    });
    const clearResponse = await app.inject({
      method: "POST",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker/clear`,
    });
    const blockedAfterClearResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/blocked",
    });
    const blockerPayload = blockerResponse.json() as {
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
    const blockedPayload = blockedResponse.json() as {
      blocked: {
        items: Array<{
          blocker: {
            blockerNote?: string;
          };
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
    const inspectPayload = inspectResponse.json() as {
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
    const applyPayload = applyResponse.json() as {
      application: {
        application: {
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearPayload = clearResponse.json() as {
      blocker: {
        blocker: {
          blockerNote?: string;
        };
      };
    };
    const blockedAfterClearPayload = blockedAfterClearResponse.json() as {
      blocked: {
        totalCount: number;
      };
    };

    expect(createResponse.statusCode).toBe(201);
    expect(reviewResponse.statusCode).toBe(200);
    expect(assignmentResponse.statusCode).toBe(200);
    expect(checklistResponse.statusCode).toBe(200);
    expect(progressResponse.statusCode).toBe(200);
    expect(blockerResponse.statusCode).toBe(200);
    expect(blockerPayload.blocker.progress.progress.completionNote).toBe(
      "Inline blocker follow-up is underway",
    );
    expect(blockerPayload.blocker.blocker.blockerNote).toBe(
      "Waiting for overnight confirmation",
    );
    expect(blockerPayload.blocker.blocker.items).toEqual([
      {
        item: "Confirm inline handoff",
        state: "cleared",
      },
      {
        item: "Close follow-up",
        state: "blocked",
      },
    ]);
    expect(blockedResponse.statusCode).toBe(200);
    expect(blockedPayload.blocked.totalCount).toBe(1);
    expect(
      blockedPayload.blocked.items[0]?.progress.checklist.assignment.review
        .visibility.catalogEntry.entry.id,
    ).toBe("catalog_entry_blocker_api");
    expect(inspectResponse.statusCode).toBe(200);
    expect(inspectPayload.blocker.blocker.blockerNote).toBe(
      "Waiting for overnight confirmation",
    );
    expect(inspectPayload.blocker.blocker.items).toEqual([
      {
        item: "Confirm inline handoff",
        state: "cleared",
      },
      {
        item: "Close follow-up",
        state: "blocked",
      },
    ]);
    expect(applyResponse.statusCode).toBe(200);
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(clearResponse.statusCode).toBe(200);
    expect(clearPayload.blocker.blocker.blockerNote).toBe(
      "Waiting for overnight confirmation",
    );
    expect(blockedAfterClearResponse.statusCode).toBe(200);
    expect(blockedAfterClearPayload.blocked.totalCount).toBe(0);
  });

  it("resolves, lists-resolved, inspects, clears, and reapplies blocked catalog entries through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-resolutions-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        catalogEntryIdGenerator: () => "catalog_entry_resolution_api",
        operatorId: "ops_oncall",
        operatorScopeId: "ops",
        savedViewIdGenerator: () => "saved_view_resolution_api",
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const createResponse = await app.inject({
      method: "POST",
      payload: {
        input: {
          approvalRequired: false,
          commandAlias: "print-ready",
          runbookId: "node-health-check",
        },
        templateId: "shell-runbook-flow",
      },
      url: "/runs",
    });
    const createdPayload = createResponse.json() as {
      run: {
        id: string;
      };
    };
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        name: "Saved resolution detail",
        navigation: {
          drilldown: {
            runId: createdPayload.run.id,
          },
          summary: {
            definitionId: "shell-runbook-flow",
          },
        },
        refs: {
          auditViewRunId: createdPayload.run.id,
        },
      },
      url: "/audit/saved-views",
    });
    const savedViewPayload = saveResponse.json() as {
      savedView: {
        id: string;
      };
    };
    const publishResponse = await app.inject({
      method: "POST",
      payload: {
        savedViewId: savedViewPayload.savedView.id,
      },
      url: "/audit/catalog",
    });
    const publishedPayload = publishResponse.json() as {
      catalogEntry: {
        entry: {
          id: string;
        };
      };
    };
    const reviewResponse = await app.inject({
      method: "POST",
      payload: {
        note: "Resolution-ready inline follow-up",
        state: "reviewed",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/review`,
    });
    const assignmentResponse = await app.inject({
      method: "POST",
      payload: {
        assigneeId: "ops_oncall",
        handoffNote: "Inline resolutions remain with the owner",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/assignment`,
    });
    const checklistResponse = await app.inject({
      method: "POST",
      payload: {
        items: ["Confirm inline handoff", "Close follow-up"],
        state: "pending",
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/checklist`,
    });
    const progressResponse = await app.inject({
      method: "POST",
      payload: {
        completionNote: "Inline resolution follow-up is underway",
        items: [
          {
            item: "Confirm inline handoff",
            state: "completed",
          },
          {
            item: "Close follow-up",
            state: "pending",
          },
        ],
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/progress`,
    });
    const blockerResponse = await app.inject({
      method: "POST",
      payload: {
        blockerNote: "Waiting for overnight confirmation",
        items: [
          {
            item: "Confirm inline handoff",
            state: "cleared",
          },
          {
            item: "Close follow-up",
            state: "blocked",
          },
        ],
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/blocker`,
    });
    const resolutionResponse = await app.inject({
      method: "POST",
      payload: {
        resolutionNote:
          "Inline follow-up is ready to close after backup sign-off",
        items: [
          {
            item: "Confirm inline handoff",
            state: "resolved",
          },
          {
            item: "Close follow-up",
            state: "unresolved",
          },
        ],
      },
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/resolution`,
    });
    const resolvedResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/resolved",
    });
    const inspectResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/resolution`,
    });
    const applyResponse = await app.inject({
      method: "GET",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/apply`,
    });
    const clearResponse = await app.inject({
      method: "POST",
      url: `/audit/catalog/${publishedPayload.catalogEntry.entry.id}/resolution/clear`,
    });
    const resolvedAfterClearResponse = await app.inject({
      method: "GET",
      url: "/audit/catalog/resolved",
    });
    const resolutionPayload = resolutionResponse.json() as {
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
    const resolvedPayload = resolvedResponse.json() as {
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
          resolution: {
            resolutionNote?: string;
          };
        }>;
        totalCount: number;
      };
    };
    const inspectPayload = inspectResponse.json() as {
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
    const applyPayload = applyResponse.json() as {
      application: {
        application: {
          savedView: {
            id: string;
          };
        };
      };
    };
    const clearPayload = clearResponse.json() as {
      resolution: {
        resolution: {
          resolutionNote?: string;
        };
      };
    };
    const resolvedAfterClearPayload = resolvedAfterClearResponse.json() as {
      resolved: {
        totalCount: number;
      };
    };

    expect(createResponse.statusCode).toBe(201);
    expect(reviewResponse.statusCode).toBe(200);
    expect(assignmentResponse.statusCode).toBe(200);
    expect(checklistResponse.statusCode).toBe(200);
    expect(progressResponse.statusCode).toBe(200);
    expect(blockerResponse.statusCode).toBe(200);
    expect(resolutionResponse.statusCode).toBe(200);
    expect(resolutionPayload.resolution.blocker.blocker.blockerNote).toBe(
      "Waiting for overnight confirmation",
    );
    expect(resolutionPayload.resolution.resolution.resolutionNote).toBe(
      "Inline follow-up is ready to close after backup sign-off",
    );
    expect(resolutionPayload.resolution.resolution.items).toEqual([
      {
        item: "Confirm inline handoff",
        state: "resolved",
      },
      {
        item: "Close follow-up",
        state: "unresolved",
      },
    ]);
    expect(resolvedResponse.statusCode).toBe(200);
    expect(resolvedPayload.resolved.totalCount).toBe(1);
    expect(
      resolvedPayload.resolved.items[0]?.blocker.progress.checklist.assignment
        .review.visibility.catalogEntry.entry.id,
    ).toBe("catalog_entry_resolution_api");
    expect(inspectResponse.statusCode).toBe(200);
    expect(inspectPayload.resolution.resolution.resolutionNote).toContain(
      "backup sign-off",
    );
    expect(inspectPayload.resolution.resolution.items).toEqual([
      {
        item: "Confirm inline handoff",
        state: "resolved",
      },
      {
        item: "Close follow-up",
        state: "unresolved",
      },
    ]);
    expect(applyResponse.statusCode).toBe(200);
    expect(applyPayload.application.application.savedView.id).toBe(
      savedViewPayload.savedView.id,
    );
    expect(clearResponse.statusCode).toBe(200);
    expect(clearPayload.resolution.resolution.resolutionNote).toBe(
      "Inline follow-up is ready to close after backup sign-off",
    );
    expect(resolvedAfterClearResponse.statusCode).toBe(200);
    expect(resolvedAfterClearPayload.resolved.totalCount).toBe(0);
  });

  it("rejects invalid catalog review state through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-review-invalid-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const reviewResponse = await app.inject({
      method: "POST",
      payload: {
        state: "invalid",
      },
      url: "/audit/catalog/catalog_entry_invalid/review",
    });

    expect(reviewResponse.statusCode).toBe(400);
    expect(reviewResponse.body).toContain(
      "state must be one of recommended|reviewed.",
    );
  });

  it("rejects invalid catalog checklist state through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-checklist-invalid-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const checklistResponse = await app.inject({
      method: "POST",
      payload: {
        state: "invalid",
      },
      url: "/audit/catalog/catalog_entry_invalid/checklist",
    });

    expect(checklistResponse.statusCode).toBe(400);
    expect(checklistResponse.body).toContain(
      "state must be one of pending|completed.",
    );
  });

  it("rejects invalid catalog checklist item progress through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-progress-invalid-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const progressResponse = await app.inject({
      method: "POST",
      payload: {
        items: [
          {
            item: "Validate queued follow-up",
            state: "invalid",
          },
        ],
      },
      url: "/audit/catalog/catalog_entry_invalid/progress",
    });

    expect(progressResponse.statusCode).toBe(400);
    expect(progressResponse.body).toContain(
      "items must be an array of { item, state } objects with state pending|completed.",
    );
  });

  it("rejects invalid catalog checklist item blockers through the operator API", async () => {
    const workspaceRoot = await mkdtemp(
      join(tmpdir(), "runroot-api-blocker-invalid-"),
    );
    app = buildServer({
      operator: createRunrootOperatorService({
        workspacePath: join(workspaceRoot, "workspace.json"),
      }),
    });

    const blockerResponse = await app.inject({
      method: "POST",
      payload: {
        items: [
          {
            item: "Validate queued follow-up",
            state: "invalid",
          },
        ],
      },
      url: "/audit/catalog/catalog_entry_invalid/blocker",
    });

    expect(blockerResponse.statusCode).toBe(400);
    expect(blockerResponse.body).toContain(
      "items must be an array of { item, state } objects with state blocked|cleared.",
    );
  });
});
