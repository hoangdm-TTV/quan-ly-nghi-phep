import { query } from '@/lib/db/pool';
import { SafeUser } from '@/lib/types/user';
import { canSubmitPersonalRequests } from '@/lib/auth/roles';
import { buildReportDataScope } from '@/lib/auth/data-scope';
import { LeaveStatus, ApprovalAction } from './workflow';

export interface LeaveRequestDetail {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_role: string;
  department_id: string | null;
  department_name: string | null;
  team_id: string | null;
  team_name: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason: string | null;
  status: LeaveStatus;
  document_url: string | null;
  approver_id: string | null;
  approver_name: string | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ApprovalHistoryRecord {
  id: string;
  request_id: string;
  approver_id: string;
  approver_name: string;
  approver_role: string;
  action: ApprovalAction;
  comment: string | null;
  created_at: Date;
}

/**
 * Danh sách đơn nghỉ phép của chính người dùng đang đăng nhập.
 */
export async function getVisibleLeaveRequests(
  user: SafeUser,
  statusFilter?: string
): Promise<LeaveRequestDetail[]> {
  if (!canSubmitPersonalRequests(user.role)) return [];
  let sql = `
    SELECT 
      lr.id,
      lr.employee_id,
      u.full_name AS employee_name,
      u.email AS employee_email,
      u.role AS employee_role,
      u.department_id,
      d.name AS department_name,
      u.team_id,
      t.name AS team_name,
      TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS start_date,
      TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS end_date,
      lr.duration_days::float AS duration_days,
      lr.reason,
      lr.status,
      lr.document_url,
      lr.approver_id,
      app.full_name AS approver_name,
      lr.rejection_reason,
      lr.created_at,
      lr.updated_at
    FROM leave_requests lr
    JOIN users u ON lr.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users app ON lr.approver_id = app.id
    WHERE lr.employee_id = $1
  `;

  const params: any[] = [user.id];

  if (statusFilter && statusFilter !== 'ALL') {
    params.push(statusFilter);
    sql += ` AND lr.status = $` + params.length;
  }

  sql += ` ORDER BY lr.created_at DESC`;

  const res = await query<LeaveRequestDetail>(sql, params);
  return res.rows;
}

/**
 * Lấy chi tiết một đơn nghỉ phép theo ID
 */
export async function getLeaveRequestById(id: string): Promise<LeaveRequestDetail | null> {
  const sql = `
    SELECT 
      lr.id,
      lr.employee_id,
      u.full_name AS employee_name,
      u.email AS employee_email,
      u.role AS employee_role,
      u.department_id,
      d.name AS department_name,
      u.team_id,
      t.name AS team_name,
      TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS start_date,
      TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS end_date,
      lr.duration_days::float AS duration_days,
      lr.reason,
      lr.status,
      lr.document_url,
      lr.approver_id,
      app.full_name AS approver_name,
      lr.rejection_reason,
      lr.created_at,
      lr.updated_at
    FROM leave_requests lr
    JOIN users u ON lr.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users app ON lr.approver_id = app.id
    WHERE lr.id = $1
    LIMIT 1
  `;
  const res = await query<LeaveRequestDetail>(sql, [id]);
  return res.rows[0] || null;
}

/**
 * Lấy lịch sử phê duyệt của một đơn nghỉ phép
 */
export async function getLeaveApprovalHistory(requestId: string): Promise<ApprovalHistoryRecord[]> {
  const sql = `
    SELECT 
      ah.id,
      ah.request_id,
      ah.approver_id,
      u.full_name AS approver_name,
      u.role AS approver_role,
      ah.action,
      ah.comment,
      ah.created_at
    FROM approval_history ah
    JOIN users u ON ah.approver_id = u.id
    WHERE ah.request_id = $1 AND ah.request_type = 'LEAVE'
    ORDER BY ah.created_at ASC
  `;
  const res = await query<ApprovalHistoryRecord>(sql, [requestId]);
  return res.rows;
}

export interface LeaveDocumentMetadata {
  document_mime_type: string;
  document_file_name: string;
  document_uploaded_at: Date;
}

export async function getLeaveDocumentMetadataById(id: string): Promise<LeaveDocumentMetadata | null> {
  const result = await query<LeaveDocumentMetadata>(
    `SELECT document_mime_type, document_file_name, document_uploaded_at
       FROM leave_requests
      WHERE id = $1 AND document_data IS NOT NULL
      LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Lấy danh sách các đơn nghỉ phép đang chờ người dùng hiện tại phê duyệt
 */
export async function getPendingLeaveRequestsForApprover(
  approver: SafeUser
): Promise<LeaveRequestDetail[]> {
  // Chỉ Manager và Director được duyệt nghỉ phép.
  if (approver.role !== 'MANAGER' && approver.role !== 'DIRECTOR') {
    return [];
  }

  let whereClause = '';
  const params: any[] = [approver.id];

  if (approver.role === 'DIRECTOR') {
    // Cấp 2 sau Manager và đơn của Manager theo luồng hiện có.
    whereClause = `
      (
        lr.status = 'APPROVED_BY_LEAD'
        OR (lr.status = 'PENDING' AND u.role = 'MANAGER')
        OR (
          lr.status = 'PENDING'
          AND u.role IN ('STAFF', 'TEAM_LEAD', 'ACCOUNTANT')
          AND (
            u.department_id IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM users active_manager
              WHERE active_manager.department_id = u.department_id
                AND active_manager.role = 'MANAGER'
                AND active_manager.is_active = true
            )
          )
        )
      )
    `;
  } else if (approver.role === 'MANAGER') {
    if (!approver.department_id) return [];
    params.push(approver.department_id);
    // Trưởng phòng duyệt cấp 1 cho nhân viên cùng phòng ban.
    whereClause = `
      lr.status = 'PENDING'
      AND u.department_id = $2
      AND u.role IN ('STAFF', 'TEAM_LEAD', 'ACCOUNTANT')
    `;
  }

  const sql = `
    SELECT 
      lr.id,
      lr.employee_id,
      u.full_name AS employee_name,
      u.email AS employee_email,
      u.role AS employee_role,
      u.department_id,
      d.name AS department_name,
      u.team_id,
      t.name AS team_name,
      TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS start_date,
      TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS end_date,
      lr.duration_days::float AS duration_days,
      lr.reason,
      lr.status,
      lr.document_url,
      lr.approver_id,
      app.full_name AS approver_name,
      lr.rejection_reason,
      lr.created_at,
      lr.updated_at
    FROM leave_requests lr
    JOIN users u ON lr.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users app ON lr.approver_id = app.id
    WHERE lr.employee_id != $1
      AND ${whereClause}
    ORDER BY lr.created_at ASC
  `;

  const res = await query<LeaveRequestDetail>(sql, params);
  return res.rows;
}

export interface ScopedLeaveFilter {
  status?: string;
  employeeId?: string;
  departmentId?: string;
  teamId?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Lấy đơn nghỉ phép theo phạm vi quyền của người dùng (cá nhân / phòng / team / toàn công ty).
 * Hỗ trợ lọc theo trạng thái, nhân viên cụ thể, và khoảng ngày nghỉ.
 */
export async function getScopedLeaveRequests(
  user: SafeUser,
  filter: ScopedLeaveFilter = {}
): Promise<LeaveRequestDetail[]> {
  const scope = buildReportDataScope(user, 'u');
  const params: any[] = [...scope.params];
  const conditions: string[] = [scope.whereSql];

  if (filter.status && filter.status !== 'ALL') {
    params.push(filter.status);
    conditions.push(`lr.status = $${params.length}`);
  }
  if (filter.employeeId) {
    params.push(filter.employeeId);
    conditions.push(`lr.employee_id = $${params.length}`);
  }
  if (filter.departmentId) {
    params.push(filter.departmentId);
    conditions.push(`u.department_id = $${params.length}`);
  }
  if (filter.teamId) {
    params.push(filter.teamId);
    conditions.push(`u.team_id = $${params.length}`);
  }
  if (filter.fromDate) {
    params.push(filter.fromDate);
    conditions.push(`lr.start_date >= $${params.length}`);
  }
  if (filter.toDate) {
    params.push(filter.toDate);
    conditions.push(`lr.start_date <= $${params.length}`);
  }

  const sql = `
    SELECT 
      lr.id,
      lr.employee_id,
      u.full_name AS employee_name,
      u.email AS employee_email,
      u.role AS employee_role,
      u.department_id,
      d.name AS department_name,
      u.team_id,
      t.name AS team_name,
      TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS start_date,
      TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS end_date,
      lr.duration_days::float AS duration_days,
      lr.reason,
      lr.status,
      lr.document_url,
      lr.approver_id,
      app.full_name AS approver_name,
      lr.rejection_reason,
      lr.created_at,
      lr.updated_at
    FROM leave_requests lr
    JOIN users u ON lr.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users app ON lr.approver_id = app.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY lr.start_date DESC, lr.created_at DESC
  `;

  const res = await query<LeaveRequestDetail>(sql, params);
  return res.rows;
}
