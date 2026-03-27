# Approval Flow

Approvals are treated as first-class workflow state, not an afterthought.

Planned flow:

1. runtime creates an approval request
2. run transitions into a waiting state
3. operator decision is recorded
4. runtime resumes, rejects, or cancels based on policy

Phase 1 only prepares the package boundary and operator-facing docs.
