-- Lead Enrichment Fields
-- Created: 2026-05-06 for Skerry AI Agent Phase 4

-- Add enrichment columns to leads table
alter table public.leads add column if not exists enriched_data jsonb;

-- Index for enriched data queries
create index if not exists idx_leads_enriched_data
  on public.leads using gin (enriched_data);

-- RLS Policy for enrichment data (workspace members can read/update)
create policy "Users can read lead enrichment"
  on public.leads for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = leads.workspace_id
      and wm.user_id = auth.uid()
    )
  );

create policy "Users can update lead enrichment"
  on public.leads for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = leads.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'member')
    )
  );