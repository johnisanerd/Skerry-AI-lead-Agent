-- Enterprise rate limiting table
-- Uses PostgreSQL as distributed store for express-rate-limit
-- Supports workspace/user/API key scoping

create table if not exists rate_limit_buckets (
  key text not null primary key,
  window_start timestamptz not null,
  request_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for cleanup of expired entries
create index if not exists idx_rate_limit_buckets_window_start 
  on rate_limit_buckets(window_start);

-- Index for key lookups (already primary key, but explicit for documentation)
-- Primary key covers this: idx_rate_limit_buckets_key

-- Cleanup function to remove expired entries (can be called periodically)
create or replace function cleanup_rate_limit_buckets(cutoff_time timestamptz)
returns integer as $$
declare
  deleted_count integer;
begin
  delete from rate_limit_buckets
  where window_start < cutoff_time;
  
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql;

-- Add comment for documentation
comment on table rate_limit_buckets is 'Distributed rate limiting buckets for enterprise-grade rate limiting. Replaces in-memory store with PostgreSQL-backed storage.';
comment on column rate_limit_buckets.key is 'Composite key: includes scope (ip/user/workspace/apikey) + identifier + window';
comment on column rate_limit_buckets.window_start is 'Start time of the rate limit window';
comment on column rate_limit_buckets.request_count is 'Number of requests made in this window';
