-- =============================================================================
-- Migration: 04_holidays.sql
-- Mô tả: Tạo bảng ngày lễ (holidays) để tính số ngày nghỉ phép chính xác.
-- Hỗ trợ cả ngày lễ đơn lẻ và khoảng ngày (ví dụ: nghỉ Tết từ 25/01 đến 01/02).
-- Chỉ DIRECTOR được quản lý ngày lễ theo lib/auth/roles.ts.
-- Dự án: Leave & Gate Pass Management System
-- =============================================================================

CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_holiday_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_dates ON holidays(start_date, end_date) WHERE is_active = TRUE;

-- Seed dữ liệu mẫu ngày lễ Việt Nam
INSERT INTO holidays (name, start_date, end_date)
SELECT seed.name, seed.start_date, seed.end_date
FROM (VALUES
    ('Tết Dương Lịch', DATE '2026-01-01', DATE '2026-01-01'),
    ('Giỗ tổ Hùng Vương', DATE '2026-04-02', DATE '2026-04-02'),
    ('Ngày Giải phóng miền Nam', DATE '2026-04-30', DATE '2026-04-30'),
    ('Ngày Quốc tế Lao động', DATE '2026-05-01', DATE '2026-05-01'),
    ('Ngày Quốc khánh', DATE '2026-09-02', DATE '2026-09-02')
) AS seed(name, start_date, end_date)
WHERE NOT EXISTS (
    SELECT 1 FROM holidays h
    WHERE lower(trim(h.name)) = lower(trim(seed.name))
      AND h.start_date = seed.start_date
      AND h.end_date = seed.end_date
);
