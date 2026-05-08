-- Migration: Add idempotency support for email sends and job processing
-- Date: 2026-05-08

-- Add idempotency_key column to email_sends table
ALTER TABLE IF EXISTS public.email_sends 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- Create index for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_sends_idempotency_key 
ON public.email_sends(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Create job_idempotency table for tracking job execution
CREATE TABLE IF NOT EXISTS public.job_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create index for cleanup of expired keys
CREATE INDEX IF NOT EXISTS idx_job_idempotency_expires_at 
ON public.job_idempotency(expires_at);

-- Create index for workspace lookups
CREATE INDEX IF NOT EXISTS idx_job_idempotency_workspace 
ON public.job_idempotency(workspace_id, job_type);

-- Add comment
COMMENT ON TABLE public.job_idempotency IS 'Stores idempotency keys for background jobs to prevent duplicate execution';
COMMENT ON COLUMN public.email_sends.idempotency_key IS 'Unique key to prevent duplicate email sends';

-- Create a function to clean up expired idempotency keys (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.job_idempotency 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
