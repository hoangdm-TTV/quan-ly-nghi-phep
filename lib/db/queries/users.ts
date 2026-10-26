import { query } from '../pool';
import { SafeUser, UserWithPassword } from '@/lib/types/user';
import { buildReportDataScope } from '@/lib/auth/data-scope';

export interface ScopedUserOption {
  id: string;
  full_name: string;
  role: string;
}

export interface ScopedFilterOptions {
  departments: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string; department_id: string | null }>;
}

/**
 * Lấy danh sách nhân viên trong phạm vi quyền của người dùng (trừ chính họ).
 * Dùng cho dropdown lọc theo nhân viên trong trang danh sách đơn.
 */
export async function getUsersInScope(
  user: SafeUser,
  departmentId?: string,
  teamId?: string
): Promise<ScopedUserOption[]> {
  const scope = buildReportDataScope(user, 'u');
  const params: any[] = [...scope.params];
  const conditions = [scope.whereSql];
  if (departmentId) {
    params.push(departmentId);
    conditions.push(`u.department_id = $${params.length}`);
  }
  if (teamId) {
    params.push(teamId);
    conditions.push(`u.team_id = $${params.length}`);
  }
  const sql = `
    SELECT u.id, u.full_name, u.role
    FROM users u
    WHERE ${conditions.join(' AND ')}
      AND u.id != $${params.length + 1}
      AND u.is_active = true
    ORDER BY u.full_name ASC
  `;
  params.push(user.id);
  const res = await query<ScopedUserOption>(sql, params);
  return res.rows;
}

/** Lấy các phòng ban/team thực tế có nhân sự trong phạm vi được xem. */
export async function getFilterOptionsInScope(
  user: SafeUser,
  departmentId?: string,
  teamId?: string
): Promise<ScopedFilterOptions> {
  const scope = buildReportDataScope(user, 'u');
  const baseParams: any[] = [...scope.params];
  const conditions = [scope.whereSql];
  if (departmentId) {
    baseParams.push(departmentId);
    conditions.push(`u.department_id = $${baseParams.length}`);
  }
  if (teamId) {
    baseParams.push(teamId);
    conditions.push(`u.team_id = $${baseParams.length}`);
  }
  const [departments, teams] = await Promise.all([
    query<{ id: string; name: string }>(
      `SELECT DISTINCT d.id, d.name
         FROM users u
         JOIN departments d ON d.id = u.department_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY d.name`,
      baseParams
    ),
    query<{ id: string; name: string; department_id: string | null }>(
      `SELECT DISTINCT t.id, t.name, t.department_id
         FROM users u
         JOIN teams t ON t.id = u.team_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.name`,
      baseParams
    ),
  ]);
  return { departments: departments.rows, teams: teams.rows };
}

/**
 * Tìm người dùng theo email (kèm password_hash để xác thực phía server)
 * Chỉ dùng trong module auth nội bộ, không bao giờ gửi password_hash ra client
 */
export async function getUserByEmail(email: string): Promise<UserWithPassword | null> {
  const sql = `
    SELECT id, email, full_name, role, department_id, team_id, manager_id, password_hash, is_active, created_at, updated_at
    FROM users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
  `;
  const result = await query<UserWithPassword>(sql, [email.trim()]);
  return result.rows[0] || null;
}

/**
 * Lấy thông tin người dùng an toàn theo ID (đã loại bỏ password_hash)
 * Kèm theo tên phòng ban (department_name) và tên nhóm (team_name)
 */
export async function getSafeUserById(id: string): Promise<SafeUser | null> {
  const sql = `
    SELECT 
      u.id, 
      u.email, 
      u.full_name, 
      u.role, 
      u.department_id, 
      d.name AS department_name,
      u.team_id, 
      t.name AS team_name,
      u.manager_id, 
      u.is_active
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN teams t ON u.team_id = t.id
    WHERE u.id = $1
    LIMIT 1
  `;
  const result = await query<SafeUser>(sql, [id]);
  return result.rows[0] || null;
}
