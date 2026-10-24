import { query } from '@/lib/db/pool';
import { SafeUser } from '@/lib/types/user';
import { canSubmitPersonalRequests } from '@/lib/auth/roles';
import { OutOfficeStatus, OutOfficeReasonType } from './workflow';

export interface OutOfficeDetail {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_role: string;
  department_name: string | null;
  team_name: string | null;
  request_date: string;
  start_time: string;
  end_time: string;
  estimated_hours: number;
  reason_type: OutOfficeReasonType;
  reason: string | null;
  status: OutOfficeStatus;
  approver_id: string | null;
  approver_name: string | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OutOfficeApprovalRecord {
  id: string;
  request_id: string;
  approver_id: string;
  approver_name: string;
  approver_role: string;
  action: string;
  comment: string | null;
  created_at: Date;
}

/**
 * Danh sách đơn ra ngoài của chính người dùng đang đăng nhập.
 */
export async function getVisibleOutOfficeRequests(
  user: SafeUser,
  statusFilter?: string
): Promise<OutOfficeDetail[]> {
  if (!canSubmitPersonalRequests(user.role)) return [];
  let sql = `
    SELECT 
      oo.id,
      oo.employee_id,
      u.full_name AS employee_name,
      u.email AS employee_email,
      u.role AS employee_role,
      d.name AS department_name,
      t.name AS team_name,
      TO_CHAR(oo.request_date, 'YYYY-MM-DD') AS request_date,
      TO_CHAR(oo.start_time, 'HH24:MI') AS start_time,
      TO_CHAR(oo.end_time, 'HH24:MI') AS end_time,
      oo.estimated_hours::float AS estimated_hours,
      oo.reason_type,
      oo.reason,
      oo.status,
      oo.approver_id,
      app.full_name AS approver_name,
      oo.rejection_reason,
      oo.created_at,
      oo.updated_at
    FROM out_office_requests oo
    JOIN users u ON oo.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users app ON oo.approver_id = app.id
    WHERE oo.employee_id = $1
  `;

  const params: any[] = [user.id];

  if (statusFilter && statusFilter !== 'ALL') {
    params.push(statusFilter);
    sql += ` AND oo.status = $${params.length}`;
  }

  sql += ` ORDER BY oo.created_at DESC`;

  const res = await query<OutOfficeDetail>(sql, params);
  return res.rows;
}

/**
 * Lấy chi tiết đơn ra ngoài theo ID
 */
export async function getOutOfficeRequestById(id: string): Promise<OutOfficeDetail | null> {
  const sql = `
    SELECT 
      oo.id,
      oo.employee_id,
      u.full_name AS employee_name,
      u.email AS employee_email,
      u.role AS employee_role,
      d.name AS department_name,
      t.name AS team_name,
      TO_CHAR(oo.request_date, 'YYYY-MM-DD') AS request_date,
      TO_CHAR(oo.start_time, 'HH24:MI') AS start_time,
      TO_CHAR(oo.end_time, 'HH24:MI') AS end_time,
      oo.estimated_hours::float AS estimated_hours,
      oo.reason_type,
      oo.reason,
      oo.status,
      oo.approver_id,
      app.full_name AS approver_name,
      oo.rejection_reason,
      oo.created_at,
      oo.updated_at
    FROM out_office_requests oo
    JOIN users u ON oo.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users app ON oo.approver_id = app.id
    WHERE oo.id = $1
    LIMIT 1
  `;
  const res = await query<OutOfficeDetail>(sql, [id]);
  return res.rows[0] || null;
}

/**
 * Lấy lịch sử phê duyệt của đơn ra ngoài
 */
export async function getOutOfficeApprovalHistory(requestId: string): Promise<OutOfficeApprovalRecord[]> {
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
    WHERE ah.request_id = $1 AND ah.request_type = 'OUT_OFFICE'
    ORDER BY ah.created_at ASC
  `;
  const res = await query<OutOfficeApprovalRecord>(sql, [requestId]);
  return res.rows;
}

/**
 * Lấy hàng đợi đơn ra ngoài cho Manager theo phòng ban hoặc Director toàn công ty
 */
export async function getPendingOutOfficeRequestsForApprover(
  approver: SafeUser
): Promise<OutOfficeDetail[]> {
  if (approver.role !== 'MANAGER' && approver.role !== 'DIRECTOR') {
    return [];
  }

  const params: string[] = [approver.id];
  let scopeClause = 'TRUE';
  if (approver.role === 'MANAGER') {
    // Trưởng phòng duyệt đơn của nhân viên có manager_id trỏ trực tiếp tới mình.
    scopeClause = `u.manager_id = $1 AND u.role IN ('STAFF', 'TEAM_LEAD', 'ACCOUNTANT')`;
  }

  const sql = `
    SELECT 
      oo.id,
      oo.employee_id,
      u.full_name AS employee_name,
      u.email AS employee_email,
      u.role AS employee_role,
      d.name AS department_name,
      t.name AS team_name,
      TO_CHAR(oo.request_date, 'YYYY-MM-DD') AS request_date,
      TO_CHAR(oo.start_time, 'HH24:MI') AS start_time,
      TO_CHAR(oo.end_time, 'HH24:MI') AS end_time,
      oo.estimated_hours::float AS estimated_hours,
      oo.reason_type,
      oo.reason,
      oo.status,
      oo.approver_id,
      app.full_name AS approver_name,
      oo.rejection_reason,
      oo.created_at,
      oo.updated_at
    FROM out_office_requests oo
    JOIN users u ON oo.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users app ON oo.approver_id = app.id
    WHERE oo.employee_id != $1
      AND ${scopeClause}
      AND oo.status IN ('PENDING', 'APPROVED')
    ORDER BY 
      CASE WHEN oo.status = 'PENDING' THEN 1 ELSE 2 END,
      oo.request_date ASC,
      oo.start_time ASC
  `;

  const res = await query<OutOfficeDetail>(sql, params);
  return res.rows;
}

/**
 * Lấy tất cả đơn ra ngoài trong công ty — dành cho Giám đốc và Kế toán (chỉ đọc).
 */
export async function getAllOutOfficeRequests(
  statusFilter?: string
): Promise<OutOfficeDetail[]> {
  let sql = `
    SELECT 
      oo.id,
      oo.employee_id,
      u.full_name AS employee_name,
      u.email AS employee_email,
      u.role AS employee_role,
      d.name AS department_name,
      t.name AS team_name,
      TO_CHAR(oo.request_date, 'YYYY-MM-DD') AS request_date,
      TO_CHAR(oo.start_time, 'HH24:MI') AS start_time,
      TO_CHAR(oo.end_time, 'HH24:MI') AS end_time,
      oo.estimated_hours::float AS estimated_hours,
      oo.reason_type,
      oo.reason,
      oo.status,
      oo.approver_id,
      app.full_name AS approver_name,
      oo.rejection_reason,
      oo.created_at,
      oo.updated_at
    FROM out_office_requests oo
    JOIN users u ON oo.employee_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users app ON oo.approver_id = app.id
  `;

  const params: any[] = [];

  if (statusFilter && statusFilter !== 'ALL') {
    params.push(statusFilter);
    sql += ` WHERE oo.status = ${params.length}`;
  }

  sql += ` ORDER BY oo.created_at DESC`;

  const res = await query<OutOfficeDetail>(sql, params);
  return res.rows;
}
