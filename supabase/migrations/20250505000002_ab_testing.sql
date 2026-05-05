-- A/B Testing Tables
-- Created: 2025-05-05 for Skerry AI Agent

-- A/B Tests table
create table if not exists public.ab_tests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  step_number integer not null,
  variants jsonb not null default '[]',
  status text not null default 'active' check (status in ('active','completed','paused')),
  winner_variant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sequence_id, step_number)
);

-- Add A/B test columns to email_sends
alter table public.email_sends add column if not exists ab_test_id uuid references public.ab_tests(id) on delete set null;
alter table public.email_sends add column if not exists variant_id text;

-- Indexes for performance
create index if not exists idx_ab_tests_workspace
  on public.ab_tests (workspace_id, status);

create index if not exists idx_email_sends_ab_test
  on public.email_sends (ab_test_id, variant_id);

-- RLS Policies
alter table public.ab_tests enable row level security;

-- Workspace members can read their workspace A/B tests
create policy "Users can read workspace A/B tests"
  on public.ab_tests for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = ab_tests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Workspace members can manage their workspace A/B tests
create policy "Users can manage workspace A/B tests"
  on public.ab_tests for all
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = ab_tests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- System can update email sends with A/B test data
create policy "System can update email sends A/B data"
  on public.email_sends for update
  using (true);

-- Trigger for updated_at
create trigger handle_ab_tests_updated_at
  before update on public.ab_tests
  for each row
  execute function public.handle_updated_at();
