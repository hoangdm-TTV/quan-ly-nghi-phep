import { UserRole } from '@/lib/types/user';

/** Vai trò ADMIN chỉ dùng khu vực quản trị; các vai trò nghiệp vụ vào module đơn. */
export function canAccessRequestModules(role: UserRole): boolean {
  return role !== 'ADMIN';
}

/** Staff, Team Lead, Manager và Accountant có danh sách đơn cá nhân và được tạo đơn. */
export function canSubmitPersonalRequests(role: UserRole): boolean {
  return role === 'STAFF' || role === 'TEAM_LEAD' || role === 'MANAGER' || role === 'ACCOUNTANT';
}

/** Chỉ Trưởng phòng và Giám đốc duyệt theo workflow hiện hành. Team Lead không duyệt. */
export function canApproveWorkflowRequests(role: UserRole): boolean {
  return role === 'MANAGER' || role === 'DIRECTOR';
}

/** Team Lead, Manager và Director có thể duyệt đơn ra ngoài theo cấp trực tiếp. */
export function canApproveOutOfficeRequests(role: UserRole): boolean {
  return role === 'TEAM_LEAD' || role === 'MANAGER' || role === 'DIRECTOR';
}

/** Director và Accountant xem toàn công ty; Manager xem theo phòng ban riêng. */
export function canViewAllRequests(role: UserRole): boolean {
  return role === 'DIRECTOR' || role === 'ACCOUNTANT';
}

export function canViewRequestScope(role: UserRole): boolean {
  return role === 'TEAM_LEAD' || role === 'MANAGER' || canViewAllRequests(role);
}

/** Chỉ ADMIN được quản lý ngày lễ. */
export function canManageHolidays(role: UserRole): boolean {
  return role === 'ADMIN';
}
