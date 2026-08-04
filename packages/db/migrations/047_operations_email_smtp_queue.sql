CREATE TABLE IF NOT EXISTS operations_email_smtp_readiness (
  workspace_id uuid PRIMARY KEY REFERENCES internal_workspaces(id) ON DELETE CASCADE,
  status text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  safe_error_code text,
  worker_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_email_smtp_readiness_status_check
    CHECK (status IN ('unavailable', 'configured', 'verified')),
  CONSTRAINT operations_email_smtp_readiness_error_length_check
    CHECK (safe_error_code IS NULL OR length(safe_error_code) <= 100),
  CONSTRAINT operations_email_smtp_readiness_worker_length_check
    CHECK (worker_id IS NULL OR length(worker_id) <= 300)
);

COMMENT ON TABLE operations_email_smtp_readiness IS
  'Safe, secret-free SMTP verification state written by the isolated Operations Email worker.';
