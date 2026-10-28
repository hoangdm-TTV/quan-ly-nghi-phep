-- Indexes phục vụ các truy vấn danh sách, bộ lọc và hàng đợi phê duyệt.
-- Chạy migration này một lần trên database hiện tại.

CREATE INDEX IF NOT EXISTS idx_users_department_role_active
  ON users (department_id, role, is_active);

CREATE INDEX IF NOT EXISTS idx_users_team_active
  ON users (team_id, is_active);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_created
  ON leave_requests (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leave_requests_status_created
  ON leave_requests (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status
  ON leave_requests (employee_id, status);

CREATE INDEX IF NOT EXISTS idx_out_office_employee_created
  ON out_office_requests (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_out_office_status_schedule
  ON out_office_requests (status, request_date ASC, start_time ASC);

CREATE INDEX IF NOT EXISTS idx_out_office_employee_status
  ON out_office_requests (employee_id, status);
