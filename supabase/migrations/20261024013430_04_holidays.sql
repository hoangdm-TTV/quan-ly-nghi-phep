-- Holidays table for leave day calculation
-- Supports both single-day holidays and date-range holidays (e.g. Tet holiday)
-- Managed by ACCOUNTANT role through the holidays management page

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

-- Seed sample Vietnamese holidays
INSERT INTO holidays (name, start_date, end_date) VALUES
    ('Tết Dương Lịch', '2026-01-01', '2026-01-01'),
    ('Giỗ tổ Hùng Vương', '2026-04-02', '2026-04-02'),
    ('Ngày Giải phóng miền Nam', '2026-04-30', '2026-04-30'),
    ('Ngày Quốc tế Lao động', '2026-05-01', '2026-05-01'),
    ('Ngày Quốc khánh', '2026-09-02', '2026-09-02')
ON CONFLICT DO NOTHING;