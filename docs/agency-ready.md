# Agency-Ready (90–95%) Definition

## Non-negotiables

- Multi-client isolation is enforced on every server request that reads/writes workspace-scoped data.
- Authorization is enforced server-side; UI gating is only a convenience.
- Logs never contain secrets (API keys, tokens, passwords, cookies, authorization headers).
- Data quality beats volume: fewer leads, but correct, relevant, contactable, deduplicated.

## Agency-Grade Lead Contract

A lead is considered agency-grade only if the following required fields are present and validated at the time the lead is persisted and/or exported.

### Required fields

- workspaceId
- source
- confidence
- riskLevel
- dedupKey
- emailStatus

### Recommended fields (export/handoff)

- firstName
- lastName
- title
- company
- domain
- email
- linkedin
- fitReason
- nextAction
- tags
- timestamp

## Export Contract (Default CSV/CRM)

Every export row must include, at minimum:

- firstName,lastName,title,company,domain,email,emailStatus,linkedin,source,confidence,riskLevel,fitReason,nextAction,tags,workspaceId

## Quality Gates

- Reject if any required field is missing.
- Reject if riskLevel is high.
- Reject if emailStatus is unverified and policy requires a verified contact method.
- Dedup is deterministic via dedupKey; duplicates are merged or ignored, never double-exported.

