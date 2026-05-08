#!/usr/bin/env python3
"""
Script to apply all Zod validation changes to server/index.ts
Run with: python3 server/apply_all_changes.py
"""

import re

# Read the file
with open('server/index.ts', 'r') as f:
    lines = f.readlines()

print(f"Read {len(lines)} lines from server/index.ts")

# === STEP 1: Remove duplicate schema definitions (lines 1098-1201, 0-indexed: 1097-1200) ===
start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if 'const loginSchema = z.object' in line:
        start_idx = i
    # Find the line with "app.post(\"/api/auth/login\"" after start_idx
    if start_idx and 'app.post("/api/auth/login"' in line and i > start_idx + 10:
        end_idx = i
        break

if start_idx and end_idx:
    print(f"Removing duplicate schemas at lines {start_idx+1} to {end_idx}")
    # Replace with a comment
    new_lines = lines[:start_idx] + [
        '  // ──────────── /api/auth/login\n',
        '  // Note: Schemas are now imported from ./middleware/validation.js\n',
        '\n'
    ] + lines[end_idx:]
    lines = new_lines
    print(f"After removal: {len(lines)} lines")
else:
    print("Could not find duplicate schemas block")
    print(f"start_idx: {start_idx}, end_idx: {end_idx}")

# === STEP 2: Add validation to routes ===

def add_validation_to_route(lines, route_path, method, validation_str, insert_after):
    """Add validation middleware to a route"""
    for i, line in enumerate(lines):
        # Find the route definition
        if f'"{route_path}"' in line and f'.{method.lower()}(' in lines[i-1] if i > 0 else False:
            # Found the route, now find where to insert validation
            # Look for the line with insert_after
            for j in range(i, min(i+10, len(lines))):
                if insert_after in lines[j]:
                    # Check if validation already exists
                    if 'validate(' in lines[j+1] if j+1 < len(lines) else False:
                        print(f"  ✓ {method.upper()} {route_path} already has validation")
                        return lines
                    # Insert validation after this line
                    lines.insert(j+1, f'    {validation_str}\n')
                    print(f"  ✅ Added validation to {method.upper()} {route_path}")
                    return lines
    print(f"  ❌ Could not find {method.upper()} {route_path}")
    return lines

# Routes that need validation added/updated
routes_to_update = [
    # (path, method, validation_string, insert_after)
    ('/api/workspaces', 'get', 'validate({ query: workspacesQuerySchema }),', 'requireAuth,'),
    ('/api/workspaces/:id/icp', 'get', 'validate({ params: commonSchemas.workspaceIdParam }),', 'requireAuth,'),
    ('/api/sequences', 'get', 'validate({ query: sequencesQuerySchema }),', 'requireAuth,'),
    ('/api/sequences/:id/enroll', 'post', 'validate({ params: commonSchemas.sequenceIdParam, body: enrollSequenceSchema }),', 'requireAuth,'),
    ('/api/sequences/:id/enrollments/:leadId', 'delete', 'validate({ params: commonSchemas.enrollmentParams }),', 'requireAuth,'),
    ('/api/ab-tests/:id/results', 'get', 'validate({ params: commonSchemas.abTestIdParam, query: abTestResultsQuerySchema }),', 'requireAuth,'),
    ('/api/ab-tests/:id/promote', 'post', 'validate({ params: commonSchemas.abTestIdParam, body: promoteABTestSchema }),', 'requireAuth,'),
    ('/api/leads/:id/delete-request', 'post', 'validate({ params: commonSchemas.leadIdParam }),', 'requireAuth,'),
    ('/api/workspaces/:id/data-export', 'get', 'validate({ params: commonSchemas.workspaceIdParam }),', 'requireAuth,'),
    ('/api/workspaces/:id/delete', 'delete', 'validate({ params: commonSchemas.workspaceIdParam, body: deleteWorkspaceSchema }),', 'requireAuth,'),
    ('/api/workspaces/:id/brand', 'get', 'validate({ params: commonSchemas.workspaceIdParam }),', 'asyncHandler(async (req, res) => {'),
    ('/api/workspaces/:id/brand', 'put', 'validate({ params: commonSchemas.workspaceIdParam, body: updateBrandSchema }),', 'requireAuth,'),
    ('/api/leads/export', 'get', 'validate({ query: exportLeadsQuerySchema }),', 'requireAuth,'),
    ('/api/audit/logs', 'get', 'validate({ query: auditLogsQuerySchema }),', 'requireAuth,'),
    ('/api/audit/logs/export', 'get', 'validate({ query: auditLogsQuerySchema }),', 'requireAuth,'),
    ('/api/health', 'get', 'validate({ query: healthQuerySchema }),', '(_req, res) => {'),
    ('/api/ready', 'get', 'validate({ query: healthQuerySchema }),', 'asyncHandler(async (_req, res) => {'),
    ('/api/billing/webhook', 'post', 'validate({ body: billingWebhookSchema }),', 'asyncHandler(async (req, res) => {'),
]

print("\nApplying validation to routes...")
for route in routes_to_update:
    path, method, validation, insert_after = route
    lines = add_validation_to_route(lines, path, method, validation, insert_after)

# Write the updated file
with open('server/index.ts', 'w') as f:
    f.writelines(lines)

print("\n✅ All changes applied to server/index.ts")
print("\nNext steps:")
print("1. Review the changes: git diff server/index.ts")
print("2. Run validation check: npx ts-node server/check-routes.ts")
print("3. Test the application")
