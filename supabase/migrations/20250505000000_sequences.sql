-- Sequence Engine Tables
-- Created: 2025-05-05 for Skerry AI Agent

-- Sequences: Follow-up Email Templates
create table if not exists public.sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  steps jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sequence Enrollments: Which Leads are in which Sequences
create table if not exists public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  current_step integer not null default 1,
  status text not null default 'active' check (status in ('active','replied','completed','paused')),
  next_send_at timestamptz,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lead_id, sequence_id)
);

-- Email Sends: Track individual email sends for reply detection
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_enrollment_id uuid references public.sequence_enrollments(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  body text not null,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'pending' check (status in ('pending','sent','delivered','opened','clicked','replied','bounced','failed')),
  events jsonb not null default '[]',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_enrollments_next_send
  on public.sequence_enrollments (next_send_at)
  where status = 'active';

create index if not exists idx_enrollments_workspace
  on public.sequence_enrollments (workspace_id, status);

create index if not exists idx_email_sends_lead
  on public.email_sends (lead_id, created_at desc);

create index if not exists idx_email_sends_workspace
  on public.email_sends (workspace_id, created_at desc);

-- RLS Policies
alter table public.sequences enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.email_sends enable row level security;

-- Sequences: Workspace members can read/write their workspace sequences
create policy "Users can manage workspace sequences"
  on public.sequences for all
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = sequences.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Sequence Enrollments: Workspace members can read/write their workspace enrollments
create policy "Users can manage workspace enrollments"
  on public.sequence_enrollments for all
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = sequence_enrollments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Email Sends: Workspace members can read their workspace email sends
create policy "Users can read workspace email sends"
  on public.email_sends for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = email_sends.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Email Sends: Only system can insert/update
create policy "System can manage email sends"
  on public.email_sends for insert
  with check (true);

create policy "System can manage email sends"
  on public.email_sends for update
  using (true);

-- Triggers for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_sequences_updated_at
  before update on public.sequences
  for each row
  execute function public.handle_updated_at();

create trigger handle_sequence_enrollments_updated_at
  before update on public.sequence_enrollments
  for each row
  execute function public.handle_updated_at();

create trigger handle_email_sends_updated_at
  before update on public.email_sends
  for each row
  execute function public.handle_updated_at();
