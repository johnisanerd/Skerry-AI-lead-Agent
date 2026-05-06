# RBAC (Workspace Roles)

## Roles

- viewer: read-only
- member: create leads, start runs, export, send/enroll (if enabled)
- admin: manage workspace settings, integrations, sequences, audit
- owner: billing, user management, delete workspace

## Enforcement

- All workspace-scoped endpoints resolve workspaceId and membership role server-side.
- Mutating endpoints enforce minimum required workspace role on the server.

