-- =============================================================================
-- Migration: 01_initial_schema.sql
-- Mô tả: Khởi tạo schema cơ sở theo đúng đặc tả tham chiếu Giai đoạn 1
-- Dự án: Leave & Gate Pass Management System
-- Lưu ý: Không tự ý thêm password, created_at, approval_history vào schema gốc này.
-- Các phần mở rộng cần thiết sẽ được đề xuất và thực hiện ở Giai đoạn 2 sau khi duyệt.
-- =============================================================================

-- Kích hoạt extension hỗ trợ sinh UUID (PostgreSQL 13+ đã tích hợp sẵn gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Bảng phòng ban (departments)
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL
);

-- 2. Bảng nhóm/đội (teams)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL
);

-- 3. Bảng người dùng (users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('STAFF', 'TEAM_LEAD', 'MANAGER', 'ACCOUNTANT', 'DIRECTOR')),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 4. Bảng đơn nghỉ phép (leave_requests)
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days DECIMAL(4, 1) NOT NULL,
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED_BY_LEAD', 'WAITING_FOR_DOC', 'COMPLETED', 'REJECTED')),
    document_url TEXT,
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_leave_duration CHECK (duration_days > 0)
);

-- 5. Bảng đơn ra ngoài (out_office_requests)
CREATE TABLE IF NOT EXISTS out_office_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    estimated_hours DECIMAL(4, 2) NOT NULL,
    reason_type VARCHAR(50) NOT NULL CHECK (reason_type IN ('WORK', 'PERSONAL')),
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    CONSTRAINT chk_out_office_time CHECK (end_time > start_time),
    CONSTRAINT chk_out_office_hours CHECK (estimated_hours > 0)
);
