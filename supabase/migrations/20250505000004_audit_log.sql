-- Audit Log Tables
-- Created: 2025-05-05 for Skerry AI Agent

-- Audit log table for compliance and tracking
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_audit_workspace
  on public.audit_log (workspace_id, created_at desc);

create index if not exists idx_audit_action
  on public.audit_log (action, created_at desc)
  where action is not null;

create index if not exists idx_audit_user
  on public.audit_log (user_id, created_at desc)
  where user_id is not null;

-- RLS Policies
alter table public.audit_log enable row level security;

-- Workspace members can read their workspace audit logs
create policy "Users can read workspace audit logs"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = audit_log.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- System can insert audit logs (for automated actions)
create policy "System can insert audit logs"
  on public.audit_log for insert
  with check (true);

-- Users can insert audit logs (for user actions)
create policy "Users can insert audit logs"
  on public.audit_log for insert
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = audit_log.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- No one can update audit logs (immutable)
create policy "No updates on audit logs"
  on public.audit_log for update
  using (false);

-- Only system can delete audit logs (for data retention)
create policy "System can delete audit logs"
  on public.audit_log for delete
  using (false);
