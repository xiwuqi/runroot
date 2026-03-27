# @runroot/replay

Owns replay timelines, run reconstruction, and audit-oriented derived views.

Phase 4 exports:

- a minimal run timeline projection
- a package-level query surface for replay timelines
- a boundary between persisted replay events and non-persisted tool hooks

Example:

```ts
import { createRunTimelineQuery } from "@runroot/replay";

const replay = createRunTimelineQuery({
  listByRunId: (runId) => eventRepository.listByRunId(runId),
});

const timeline = await replay.getTimeline("run_1");
```

The replay timeline is derived from persisted runtime events only. Tool invocation hooks from `@runroot/tools` stay out of the shared replay source of truth in Phase 4.
