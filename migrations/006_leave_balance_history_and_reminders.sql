BEGIN;

CREATE TABLE IF NOT EXISTS leave_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_year INTEGER NOT NULL CHECK (leave_year BETWEEN 2000 AND 2200),
    entitled_days NUMERIC(6, 1) NOT NULL CHECK (entitled_days >= 0),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, leave_year)
);

CREATE INDEX IF NOT EXISTS idx_leave_entitlements_year_user
    ON leave_entitlements (leave_year, user_id);

CREATE TABLE IF NOT EXISTS request_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('LEAVE', 'OUT_OFFICE')),
    request_id UUID NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('UPDATED', 'CANCELLED')),
    before_data JSONB,
    after_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_change_history_request
    ON request_change_history (request_type, request_id, created_at);

CREATE TABLE IF NOT EXISTS reminder_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('LEAVE', 'OUT_OFFICE')),
    request_id UUID NOT NULL,
    reminder_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (request_type, request_id, reminder_date)
);

ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check
    CHECK (status IN ('PENDING', 'APPROVED_BY_LEAD', 'WAITING_FOR_DOC', 'COMPLETED', 'REJECTED', 'CANCELLED'));

ALTER TABLE out_office_requests DROP CONSTRAINT IF EXISTS out_office_requests_status_check;
ALTER TABLE out_office_requests ADD CONSTRAINT out_office_requests_status_check
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('STAFF', 'TEAM_LEAD', 'MANAGER', 'ACCOUNTANT', 'ADMIN', 'DIRECTOR'));

INSERT INTO users (email, full_name, role, position, password_hash, is_active)
VALUES (
    'admin@trithucvietbn.com',
    'Quản trị hệ thống',
    'ADMIN',
    'Quản trị hệ thống',
    '$2a$10$.a7P.2JzFEy3Bwfj5zmE2ewkSD26QZcPYurykHlZvxD/vP4d3yqo2',
    TRUE
)
ON CONFLICT (email) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = 'ADMIN',
        position = EXCLUDED.position,
        password_hash = EXCLUDED.password_hash,
        is_active = TRUE,
        updated_at = NOW();

COMMIT;
