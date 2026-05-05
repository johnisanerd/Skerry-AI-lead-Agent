-- Intent Scoring Tables
-- Created: 2025-05-05 for Skerry AI Agent

-- Add intent scoring columns to leads table
alter table public.leads add column if not exists intent_score integer not null default 0;
alter table public.leads add column if not exists last_event text;
alter table public.leads add column if not exists last_event_at timestamptz;

-- Add indexes for performance
create index if not exists idx_leads_intent_score
  on public.leads (intent_score desc);

create index if not exists idx_leads_last_event
  on public.leads (last_event_at desc)
  where last_event is not null;

-- RLS Policy for intent score updates (workspace members can read)
create policy "Users can read lead intent scores"
  on public.leads for select
  using (
    exists (
      select 1 from public.workspace_members wm
      join public.leads l on l.workspace_id = wm.workspace_id
      where wm.user_id = auth.uid()
        and l.id = leads.id
    )
  );

-- Only system can update intent scores (webhook handler)
create policy "System can update lead intent scores"
  on public.leads for update
  using (true);
