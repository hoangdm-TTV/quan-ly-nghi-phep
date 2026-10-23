-- =============================================================================
-- Migration: 02_auth_and_extensions.sql
-- Mô tả: Bổ sung xác thực, session server-side, lịch sử duyệt và audit timestamp
-- Dự án: Leave & Gate Pass Management System
-- =============================================================================

-- 1. Bổ sung trường xác thực và trạng thái vào bảng users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- 2. Tạo bảng lưu trữ Session phía Server (Server-side Session)
-- Cookie trên trình duyệt chỉ lưu ID ngẫu nhiên, không chứa mật khẩu hay thông tin nhạy cảm
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 3. Tạo bảng lưu vết phê duyệt đa cấp (chuẩn bị sẵn cho Giai đoạn 3 & 4)
CREATE TABLE IF NOT EXISTS approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('LEAVE', 'OUT_OFFICE')),
    request_id UUID NOT NULL,
    approver_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL CHECK (action IN ('APPROVED_LEAD', 'APPROVED_DIRECTOR', 'REJECTED')),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_history_request ON approval_history(request_id);

-- 4. Bổ sung thời gian tạo/cập nhật cho bảng đơn nghỉ và đơn ra ngoài
ALTER TABLE leave_requests 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

ALTER TABLE out_office_requests 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
