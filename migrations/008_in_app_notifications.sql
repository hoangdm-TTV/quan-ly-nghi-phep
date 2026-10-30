BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications (created_at DESC);

COMMIT;
