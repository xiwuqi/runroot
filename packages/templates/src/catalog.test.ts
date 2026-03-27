import { describe, expect, it } from "vitest";

import { createTemplateCatalog } from "./catalog";

describe("@runroot/templates catalog", () => {
  it("exposes the first workflow templates with stable metadata", () => {
    const catalog = createTemplateCatalog();
    const templates = catalog.list();

    expect(templates.map((template) => template.descriptor.id)).toEqual([
      "github-issue-triage",
      "pr-review-flow",
      "slack-approval-flow",
      "shell-runbook-flow",
    ]);
    expect(
      templates.filter((template) => template.descriptor.requiresApproval),
    ).toHaveLength(3);
    expect(
      templates.filter((template) => template.descriptor.usesMcp),
    ).toHaveLength(2);
  });
});
