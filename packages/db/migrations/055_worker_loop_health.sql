BEGIN;

CREATE TABLE IF NOT EXISTS worker_loop_health (
  worker_instance_id UUID NOT NULL,
  loop_name TEXT NOT NULL CHECK (loop_name ~ '^[a-z0-9][a-z0-9_.-]{0,79}$'),
  mode TEXT NOT NULL CHECK (mode IN ('starting', 'healthy', 'backing_off', 'degraded', 'stopped', 'disabled', 'shutting_down')),
  process_started_at TIMESTAMPTZ NOT NULL,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  consecutive_successes INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_successes >= 0),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at TIMESTAMPTZ,
  safe_failure_class TEXT CHECK (safe_failure_class IS NULL OR safe_failure_class IN ('transient_infrastructure', 'configuration', 'fatal_startup', 'unknown')),
  safe_error_code TEXT CHECK (safe_error_code IS NULL OR safe_error_code ~ '^[a-z][a-z0-9_.-]{0,79}$'),
  heartbeat_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (worker_instance_id, loop_name)
);

CREATE INDEX IF NOT EXISTS worker_loop_health_loop_heartbeat_idx
  ON worker_loop_health (loop_name, heartbeat_at);

COMMIT;
