import { redirect } from 'next/navigation';
import { getSessionIdFromCookie, getSession } from './session';
import { getSafeUserById } from '@/lib/db/queries/users';
import { SafeUser, UserRole } from '@/lib/types/user';

/**
 * Lấy thông tin người dùng hiện tại từ session cookie
 * Trả về null nếu chưa đăng nhập, session hết hạn hoặc tài khoản bị khóa
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const sessionId = getSessionIdFromCookie();
  if (!sessionId) return null;

  const session = await getSession(sessionId);
  if (!session) return null;

  const user = await getSafeUserById(session.user_id);
  if (!user || !user.is_active) {
    return null;
  }

  return user;
}

/**
 * Bắt buộc người dùng phải đăng nhập để truy cập
 * Nếu chưa đăng nhập -> chuyển hướng về trang /login
 */
export async function requireAuth(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Bắt buộc người dùng phải có vai trò phù hợp
 * Nếu vai trò không nằm trong danh sách cho phép -> ném lỗi cấm truy cập (Forbidden)
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<SafeUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Access denied: You do not have permission to perform this action.');
  }
  return user;
}

/**
 * Kiểm tra quyền truy cập theo phòng ban
 */
export function canAccessDepartment(currentUser: SafeUser, targetDepartmentId: string | null): boolean {
  if (!targetDepartmentId) return false;
  // Giám đốc và Kế toán có quyền xem toàn công ty
  if (currentUser.role === 'DIRECTOR' || currentUser.role === 'ACCOUNTANT') {
    return true;
  }
  // Các vai trò khác chỉ trong phòng ban của mình
  return currentUser.department_id === targetDepartmentId;
}

/**
 * Kiểm tra quyền truy cập theo nhóm (team)
 */
export function canAccessTeam(currentUser: SafeUser, targetTeamId: string | null): boolean {
  if (!targetTeamId) return false;
  if (currentUser.role === 'DIRECTOR' || currentUser.role === 'ACCOUNTANT') {
    return true;
  }
  if (currentUser.role === 'MANAGER') {
    // Manager có quyền trong toàn bộ phòng ban của mình
    return true;
  }
  // Team Lead và Staff chỉ trong team của mình
  return currentUser.team_id === targetTeamId;
}

/**
 * Kiểm tra quyền truy cập dữ liệu của một nhân viên cụ thể
 */
export function canAccessUserData(currentUser: SafeUser, targetUser: SafeUser): boolean {
  // Được truy cập dữ liệu của chính mình
  if (currentUser.id === targetUser.id) {
    return true;
  }

  // Giám đốc và Kế toán được xem toàn bộ dữ liệu nhân viên
  if (currentUser.role === 'DIRECTOR' || currentUser.role === 'ACCOUNTANT') {
    return true;
  }

  // Manager được xem dữ liệu nhân viên trong cùng phòng ban
  if (currentUser.role === 'MANAGER' && currentUser.department_id && currentUser.department_id === targetUser.department_id) {
    return true;
  }

  // Team Lead được xem dữ liệu nhân viên trong cùng nhóm (team)
  if (currentUser.role === 'TEAM_LEAD' && currentUser.team_id && currentUser.team_id === targetUser.team_id) {
    return true;
  }

  // Nhân viên thông thường (STAFF) không được xem dữ liệu người khác
  return false;
}
