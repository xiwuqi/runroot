const phaseOneDeliverables = [
  "pnpm workspace scaffold with clear package boundaries",
  "Fastify API shell and Next.js operator shell",
  "ADR baseline, roadmap, contributing and security docs",
  "Lint, typecheck, test, integration-test, and build commands",
];

const futurePackages = [
  "@runroot/core-runtime",
  "@runroot/tools",
  "@runroot/mcp",
  "@runroot/approvals",
  "@runroot/replay",
  "@runroot/observability",
];

const phaseGoals = [
  "Do not implement runtime state transitions yet.",
  "Do not add tool execution, MCP calls, or approval logic yet.",
  "Do create seams that contributors can reason about package by package.",
];

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <div className="eyebrow">Phase 1 / Foundations</div>
        <h1>Durable workflow infrastructure, not a chat wrapper.</h1>
        <p>
          Runroot is being built as an MCP-native runtime for developer and ops
          workflows. This console is intentionally minimal in Phase 1: it
          communicates the project shape without pretending the runtime already
          exists.
        </p>
      </section>

      <section className="grid two">
        <article className="card">
          <div className="badge">Current deliverables</div>
          <h2>What exists now</h2>
          <ul>
            {phaseOneDeliverables.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <div className="badge">Guardrails</div>
          <h2>What Phase 1 must not do</h2>
          <ul>
            {phaseGoals.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="card">
        <div className="badge">Reserved package seams</div>
        <h3>Packages that become real in later phases</h3>
        <ul>
          {futurePackages.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
