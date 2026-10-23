import { query } from '../pool';
import { SafeUser, UserWithPassword } from '@/lib/types/user';

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
