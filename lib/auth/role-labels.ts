import { UserRole } from '@/lib/types/user';

export const ROLE_LABELS: Record<UserRole, string> = {
  STAFF: 'Nhân viên',
  TEAM_LEAD: 'Trưởng nhóm',
  MANAGER: 'Trưởng phòng',
  ACCOUNTANT: 'Kế toán',
  ADMIN: 'Quản trị hệ thống',
  DIRECTOR: 'Giám đốc',
};

export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  DIRECTOR: 'bg-teal-100 text-teal-800 border-teal-200',
  MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
  TEAM_LEAD: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  ACCOUNTANT: 'bg-amber-100 text-amber-800 border-amber-200',
  ADMIN: 'bg-violet-100 text-violet-800 border-violet-200',
  STAFF: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] || role;
}

export function getRoleBadgeClass(role: UserRole): string {
  return ROLE_BADGE_COLORS[role] || 'bg-slate-100 text-slate-700';
}
