-- GDPR Compliance Tables
-- Created: 2025-05-05 for Skerry AI Agent

-- Deletion requests table for GDPR Art. 17 (Right to erasure)
create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_email text not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  request_source text not null check (request_source in ('user_request','bounce','complaint')),
  deletion_deadline timestamptz not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  metadata jsonb not null default '{}'
);

-- Add anonymization columns to leads table
alter table public.leads add column if not exists anonymized_at timestamptz;
alter table public.leads add column if not exists original_lead_id text;

-- Indexes for performance
create index if not exists idx_deletion_requests_deadline
  on public.deletion_requests (deletion_deadline, status);

create index if not exists idx_deletion_requests_email
  on public.deletion_requests (user_email, status);

create index if not exists idx_leads_anonymized
  on public.leads (anonymized_at)
  where anonymized_at is not null;

-- RLS Policies
alter table public.deletion_requests enable row level security;

-- Workspace members can read deletion requests
create policy "Users can read workspace deletion requests"
  on public.deletion_requests for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = deletion_requests.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- System can manage deletion requests
create policy "System can manage deletion requests"
  on public.deletion_requests for all
  using (true);

-- Update leads policy to allow anonymization
create policy "System can anonymize leads"
  on public.leads for update
  using (true);

-- Function to automatically process deletion requests
create or replace function public.process_pending_deletions()
returns table (
  processed_requests integer,
  failed_requests integer
) as $$
declare
  processed_count integer := 0;
  failed_count integer := 0;
  request_record record;
begin
  -- Get all pending deletion requests past deadline
  for request_record in 
    select * from public.deletion_requests 
    where status = 'pending' 
      and deletion_deadline <= now()
  loop
    begin
      -- Update status to processing
      update public.deletion_requests 
      set status = 'processing', processed_at = now()
      where id = request_record.id;
      
      -- Anonymize lead data
      update public.leads set
        personal = jsonb_build_object(
          'firstName', null,
          'lastName', null,
          'email', null,
          'linkedin', null
        ),
        organization = jsonb_build_object(
          'name', 'Anonymized',
          'website', null
        ),
        extraction = jsonb_build_object(
          'iqScore', 0,
          'websiteContext', null,
          'personContext', null,
          'uniqueAngles', '[]'::jsonb
        ),
        newsletter = jsonb_build_object(
          'body', null,
          'subject', null
        ),
        anonymized_at = now(),
        original_lead_id = request_record.lead_id
      where id = request_record.lead_id;
      
      -- Delete related data
      delete from public.email_sends where lead_id = request_record.lead_id;
      delete from public.sequence_enrollments where lead_id = request_record.lead_id;
      
      -- Mark as completed
      update public.deletion_requests 
      set status = 'completed',
          metadata = jsonb_set(
            jsonb_set(request_record.metadata, '{completedAt}', to_jsonb(now())),
            '{originalLeadId}',
            to_jsonb(request_record.lead_id)
          )
      where id = request_record.id;
      
      processed_count := processed_count + 1;
      
    exception when others then
      -- Mark as failed
      update public.deletion_requests 
      set status = 'failed',
          metadata = jsonb_set(
            jsonb_set(request_record.metadata, '{error}', to_jsonb(SQLERRM)),
            '{failedAt}',
            to_jsonb(now())
          )
      where id = request_record.id;
      
      failed_count := failed_count + 1;
    end;
  end loop;
  
  return query select processed_count, failed_count;
end;
$$ language plpgsql;

-- Grant execute permission to service role
grant execute on function public.process_pending_deletions to authenticated;
grant execute on function public.process_pending_deletions to service_role;
