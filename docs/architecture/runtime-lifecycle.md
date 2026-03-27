# Runtime Lifecycle

This document describes the intended lifecycle for runs and steps without implementing it yet.

Planned run lifecycle:

1. create run
2. persist initial event
3. evaluate next step
4. execute or wait
5. checkpoint state
6. resume or finish

Phase 1 only defines the boundary. Phase 2 will implement the actual state machine.
