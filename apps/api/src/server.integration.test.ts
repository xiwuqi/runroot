import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "./server";

let app = buildServer();

afterEach(async () => {
  await app.close();
  app = buildServer();
});

describe("@runroot/api integration", () => {
  it("serves manifest data over a real network listener", async () => {
    const address = await app.listen({
      host: "127.0.0.1",
      port: 0,
    });

    const response = await fetch(`${address}/manifest/project`);
    const payload = (await response.json()) as {
      commands: string[];
      project: {
        name: string;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.project.name).toBe("Runroot");
    expect(payload.commands).toContain("pnpm build");
  });
});
