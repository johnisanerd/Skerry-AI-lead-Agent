-- White-Label Tables
-- Created: 2025-05-05 for Skerry AI Agent

-- Add white-label columns to workspaces table
alter table public.workspaces add column if not exists brand_name text;
alter table public.workspaces add column if not exists brand_logo_url text;
alter table public.workspaces add column if not exists brand_primary_color text default '#06b6d4';
alter table public.workspaces add column if not exists custom_domain text;
alter table public.workspaces add column if not exists from_email text;

-- Add indexes for performance
create index if not exists idx_workspaces_custom_domain
  on public.workspaces (custom_domain)
  where custom_domain is not null;

-- Update RLS policy to include white-label fields
create policy "Users can read workspace white-label settings"
  on public.workspaces for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  );

-- Workspace owners can update white-label settings
create policy "Workspace owners can update white-label settings"
  on public.workspaces for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- Public endpoint for brand settings (no auth required)
create view public.workspace_brand_settings as
  select 
    id as workspace_id,
    brand_name,
    brand_logo_url,
    brand_primary_color,
    custom_domain,
    from_email
  from public.workspaces
  where brand_name is not null;

-- Grant public access to brand settings
grant usage on schema public to anon;
grant select on public.workspace_brand_settings to anon;
