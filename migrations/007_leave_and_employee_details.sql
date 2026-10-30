BEGIN;

-- Thông tin bổ sung cho đơn nghỉ phép
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS day_part VARCHAR(20) NOT NULL DEFAULT 'FULL_DAY',
  ADD COLUMN IF NOT EXISTS replacement_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handover_note TEXT;

ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_day_part_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_day_part_check
  CHECK (day_part IN ('FULL_DAY', 'MORNING', 'AFTERNOON'));

CREATE INDEX IF NOT EXISTS idx_leave_requests_day_part
  ON leave_requests (start_date, end_date, day_part);

-- Trạng thái nhân sự
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_employment_status_check;
ALTER TABLE users ADD CONSTRAINT users_employment_status_check
  CHECK (employment_status IN ('ACTIVE', 'SUSPENDED', 'TERMINATED'));

UPDATE users
   SET employment_status = CASE WHEN is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END
 WHERE employment_status IS NULL OR employment_status NOT IN ('ACTIVE', 'SUSPENDED', 'TERMINATED');

CREATE INDEX IF NOT EXISTS idx_users_employment_status ON users (employment_status);

-- Nhật ký các thay đổi quan trọng
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_id, created_at DESC);

COMMIT;
