import { UserRole } from '@/lib/types/user';

/** Kế toán không dùng module đơn chi tiết. */
export function canAccessRequestModules(role: UserRole): boolean {
  return role !== 'ACCOUNTANT';
}

/** Staff, Team Lead, Manager được tạo và theo dõi đơn của chính mình. */
export function canSubmitPersonalRequests(role: UserRole): boolean {
  return role === 'STAFF' || role === 'TEAM_LEAD' || role === 'MANAGER';
}

/** Chỉ Trưởng phòng và Giám đốc duyệt theo workflow hiện hành. Team Lead không duyệt. */
export function canApproveWorkflowRequests(role: UserRole): boolean {
  return role === 'MANAGER' || role === 'DIRECTOR';
}
