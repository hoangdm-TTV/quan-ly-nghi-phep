BEGIN;

CREATE TABLE IF NOT EXISTS login_rate_limits (
    rate_key CHAR(64) PRIMARY KEY,
    window_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_login_rate_limits_window
    ON login_rate_limits (window_started_at);

COMMIT;
