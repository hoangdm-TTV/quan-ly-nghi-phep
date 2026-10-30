import { query } from '@/lib/db/pool';

export interface HrUserRow {
  id: string;
  employee_code: string | null;
  full_name: string;
  email: string;
  role: 'STAFF' | 'TEAM_LEAD' | 'MANAGER' | 'ACCOUNTANT' | 'ADMIN' | 'DIRECTOR';
  position: string | null;
  department_id: string | null;
  department_name: string | null;
  team_id: string | null;
  team_name: string | null;
  manager_id: string | null;
  manager_name: string | null;
  is_active: boolean;
}

export interface HrDepartment { id: string; name: string }
export interface HrTeam { id: string; name: string; department_id: string | null }
export interface HrLeaveEntitlement {
  user_id: string;
  full_name: string;
  employee_code: string | null;
  department_name: string | null;
  entitled_days: number;
}

export async function getRequestChangeHistory(requestType: 'LEAVE' | 'OUT_OFFICE', requestId: string) {
  const result = await query<{
    id: string; action: 'UPDATED' | 'CANCELLED'; actor_name: string | null; created_at: Date;
    before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null;
  }>(
    `SELECT h.id, h.action, u.full_name AS actor_name, h.created_at, h.before_data, h.after_data
       FROM request_change_history h LEFT JOIN users u ON u.id = h.actor_id
      WHERE h.request_type = $1 AND h.request_id = $2
      ORDER BY h.created_at ASC`,
    [requestType, requestId],
  );
  return result.rows;
}

export async function getHrAdminData(filters: { q?: string; departmentId?: string; teamId?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const page = Math.max(1, Math.min(100_000, Math.trunc(filters.page ?? 1)));
  const values: unknown[] = [];
  const conditions: string[] = [];
  if (filters.q?.trim()) {
    values.push(`%${filters.q.trim()}%`);
    conditions.push(`(u.full_name ILIKE $${values.length} OR u.email ILIKE $${values.length} OR COALESCE(u.employee_code, '') ILIKE $${values.length})`);
  }
  if (filters.departmentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filters.departmentId)) { values.push(filters.departmentId); conditions.push(`u.department_id = $${values.length}::uuid`); }
  if (filters.teamId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(filters.teamId)) { values.push(filters.teamId); conditions.push(`u.team_id = $${values.length}::uuid`); }
  if (filters.status === 'active') conditions.push('u.is_active = TRUE');
  if (filters.status === 'inactive') conditions.push('u.is_active = FALSE');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM users u ${where}`, values);
  const pageValues = [...values, pageSize + 1, (page - 1) * pageSize];
  const [users, departments, teams, managers] = await Promise.all([
    query<HrUserRow>(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.role, u.position,
              u.department_id, d.name AS department_name, u.team_id, t.name AS team_name,
              u.manager_id, m.full_name AS manager_name, u.is_active
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         LEFT JOIN teams t ON t.id = u.team_id
         LEFT JOIN users m ON m.id = u.manager_id
        ${where}
        ORDER BY u.is_active DESC, u.full_name ASC
        LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    ),
    query<HrDepartment>('SELECT id, name FROM departments ORDER BY name'),
    query<HrTeam>('SELECT id, name, department_id FROM teams ORDER BY name'),
    query<Pick<HrUserRow, 'id' | 'full_name' | 'role'>>(
      `SELECT id, full_name, role FROM users WHERE is_active = TRUE AND role IN ('TEAM_LEAD', 'MANAGER', 'DIRECTOR') ORDER BY full_name`
    ),
  ]);
  return { users: users.rows.slice(0, pageSize), departments: departments.rows, teams: teams.rows, managers: managers.rows, total: Number(count.rows[0]?.total || 0), hasNext: users.rows.length > pageSize, page, pageSize };
}

export async function getLeaveEntitlements(year: number): Promise<HrLeaveEntitlement[]> {
  const result = await query<HrLeaveEntitlement>(
    `SELECT u.id AS user_id, u.full_name, u.employee_code, d.name AS department_name,
            COALESCE(e.entitled_days, 0)::float AS entitled_days
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       LEFT JOIN leave_entitlements e ON e.user_id = u.id AND e.leave_year = $1
      WHERE u.is_active = TRUE
      ORDER BY d.name NULLS LAST, u.full_name`,
    [year]
  );
  return result.rows;
}

export async function getEmployeeLeaveBalance(userId: string, year: number) {
  const result = await query<{
    entitled_days: number;
    used_days: number;
    pending_days: number;
    has_entitlement: boolean;
  }>(
    `SELECT EXISTS (SELECT 1 FROM leave_entitlements WHERE user_id = $1 AND leave_year = $2) AS has_entitlement,
            COALESCE((SELECT entitled_days FROM leave_entitlements WHERE user_id = $1 AND leave_year = $2), 0)::float AS entitled_days,
            COALESCE((SELECT SUM(duration_days) FROM leave_requests WHERE employee_id = $1 AND EXTRACT(YEAR FROM start_date) = $2 AND status IN ('WAITING_FOR_DOC', 'COMPLETED')), 0)::float AS used_days,
            COALESCE((SELECT SUM(duration_days) FROM leave_requests WHERE employee_id = $1 AND EXTRACT(YEAR FROM start_date) = $2 AND status IN ('PENDING', 'APPROVED_BY_LEAD')), 0)::float AS pending_days`,
    [userId, year]
  );
  const row = result.rows[0] ?? { entitled_days: 0, used_days: 0, pending_days: 0, has_entitlement: false };
  return {
    ...row,
    available_days: Math.max(0, Number(row.entitled_days) - Number(row.used_days) - Number(row.pending_days)),
  };
}
