import { UserRole } from '@/lib/types/user';

/** Kế toán được dùng module đơn chi tiết (xin nghỉ + xem tất cả đơn). */
export function canAccessRequestModules(role: UserRole): boolean {
  return true;
}

/** Staff, Team Lead, Manager, Accountant được tạo và theo dõi đơn của chính mình. */
export function canSubmitPersonalRequests(role: UserRole): boolean {
  return role === 'STAFF' || role === 'TEAM_LEAD' || role === 'MANAGER' || role === 'ACCOUNTANT';
}

/** Chỉ Trưởng phòng và Giám đốc duyệt theo workflow hiện hành. Team Lead không duyệt. */
export function canApproveWorkflowRequests(role: UserRole): boolean {
  return role === 'MANAGER' || role === 'DIRECTOR';
}

/** Giám đốc và Kế toán được xem tất cả đơn trong công ty (chỉ đọc). */
export function canViewAllRequests(role: UserRole): boolean {
  return role === 'DIRECTOR' || role === 'ACCOUNTANT';
}

/** Kế toán và Giám đốc được quản lý ngày lễ. */
export function canManageHolidays(role: UserRole): boolean {
  return role === 'ACCOUNTANT' || role === 'DIRECTOR';
}
