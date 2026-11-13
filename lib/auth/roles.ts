import { UserRole } from "@/lib/types/user";

/** Vai trò ADMIN chỉ dùng khu vực quản trị; các vai trò nghiệp vụ vào module đơn. */
export function canAccessRequestModules(role: UserRole): boolean {
  return role !== "ADMIN";
}

/** Các role nghiệp vụ, gồm Director, có danh sách đơn cá nhân và được tạo đơn. */
export function canSubmitPersonalRequests(role: UserRole): boolean {
  return (
    role === "STAFF" ||
    role === "TEAM_LEAD" ||
    role === "MANAGER" ||
    role === "ACCOUNTANT" ||
    role === "DIRECTOR"
  );
}

/** Chỉ Manager và Director tham gia workflow duyệt nghỉ phép. */
export function canApproveWorkflowRequests(role: UserRole): boolean {
  return role === "MANAGER" || role === "DIRECTOR";
}

/** Chỉ Manager và Director được mở hàng đợi duyệt; đơn vẫn phải được gán qua users.manager_id. */
export function canApproveOutOfficeRequests(role: UserRole): boolean {
  return role === "MANAGER" || role === "DIRECTOR";
}

/** Director và Accountant xem toàn công ty; Manager xem theo phòng ban riêng. */
export function canViewAllRequests(role: UserRole): boolean {
  return role === "DIRECTOR" || role === "ACCOUNTANT";
}

export function canViewRequestScope(role: UserRole): boolean {
  return role === "TEAM_LEAD" || role === "MANAGER" || canViewAllRequests(role);
}

/** Chỉ ADMIN được quản lý ngày lễ. */
export function canManageHolidays(role: UserRole): boolean {
  return role === "ADMIN";
}
