import { SafeUser } from '@/lib/types/user';

export interface UserDataScope {
  whereSql: string;
  params: string[];
}

/**
 * Tạo điều kiện phạm vi đọc dữ liệu theo quyền hiện hành.
 * Alias chỉ được truyền từ các truy vấn nội bộ, không lấy từ request của client.
 */
export function buildUserDataScope(user: SafeUser, alias = 'u'): UserDataScope {
  if (user.role === 'DIRECTOR') {
    return { whereSql: 'TRUE', params: [] };
  }

  if (user.role === 'MANAGER' && user.department_id) {
    return {
      whereSql: `(${alias}.id = $1 OR ${alias}.department_id = $2)`,
      params: [user.id, user.department_id],
    };
  }

  if (user.role === 'TEAM_LEAD' && user.team_id) {
    return {
      whereSql: `(${alias}.id = $1 OR ${alias}.team_id = $2)`,
      params: [user.id, user.team_id],
    };
  }

  // STAFF và người chưa được gán phạm vi chỉ thấy dữ liệu của chính mình.
  return { whereSql: `${alias}.id = $1`, params: [user.id] };
}

/** Dùng cho các truy vấn mở rộng scope; ACCOUNTANT và DIRECTOR được xem toàn công ty. */
export function buildReportDataScope(user: SafeUser, alias = 'u'): UserDataScope {
  if (user.role === 'DIRECTOR' || user.role === 'ACCOUNTANT') {
    return { whereSql: 'TRUE', params: [] };
  }
  return buildUserDataScope(user, alias);
}

export function getUserDataScopeLabel(user: SafeUser): string {
  if (user.role === 'DIRECTOR') return 'Toàn công ty';
  if (user.role === 'ACCOUNTANT') return 'Toàn công ty (chỉ đọc)';
  if (user.role === 'MANAGER' && user.department_id) return `Phòng ban: ${user.department_name || 'Chưa đặt tên'}`;
  if (user.role === 'TEAM_LEAD' && user.team_id) return `Team: ${user.team_name || 'Chưa đặt tên'}`;
  return 'Cá nhân';
}
