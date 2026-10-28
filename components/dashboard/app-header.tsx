'use client';

import { SafeUser } from '@/lib/types/user';
import LogoutButton from '@/components/logout-button';
import Link from 'next/link';
import { Menu, Plus, Calendar, Clock, UserCheck, Bell } from 'lucide-react';
import { canSubmitPersonalRequests } from '@/lib/auth/roles';
import BrandLogo from '@/components/brand/brand-logo';
import PushNotificationSetup from '@/components/notifications/push-notification-setup';

interface AppHeaderProps {
  user: SafeUser;
  approvalCounts: {
    leave: number;
    outOffice: number;
  };
  onOpenSidebar: () => void;
}

export default function AppHeader({ user, approvalCounts, onOpenSidebar }: AppHeaderProps) {
  const canSubmit = canSubmitPersonalRequests(user.role);
  const totalApprovals = approvalCounts.leave + approvalCounts.outOffice;

  const roleBadgeColors: Record<string, string> = {
    DIRECTOR: 'bg-teal-50 text-teal-800 border-teal-200',
    MANAGER: 'bg-blue-50 text-blue-800 border-blue-200',
    TEAM_LEAD: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    ACCOUNTANT: 'bg-amber-50 text-amber-800 border-amber-200',
    STAFF: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-xs">
      {/* Mobile view: Burger button + Brand Logo (single logo when sidebar is hidden) */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          onClick={onOpenSidebar}
          aria-label="Mở menu"
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <BrandLogo size="sm" subtitle="Nội bộ" showBadge={false} />
      </div>

      {/* Desktop view: Page title / Breadcrumb context (NO DUPLICATE LOGO) */}
      <div className="hidden lg:flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">
              Cổng Quản lý Nghỉ phép & Đơn ra ngoài
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-[#005a3c] border border-emerald-200">
              TRI THỨC VIỆT
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Hệ thống quy trình nhân sự & phê duyệt trực tuyến
          </p>
        </div>
      </div>

      {/* Right side actions: Quick New Request + User profile chip + Logout */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        <PushNotificationSetup />
        {totalApprovals > 0 && (
          <Link
            href={approvalCounts.leave > 0 ? '/approvals/leave' : '/approvals/out-office'}
            className="hidden md:inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900 shadow-sm transition hover:bg-amber-100"
            title="Xem các đơn đang chờ xử lý"
          >
            <Bell className="h-3.5 w-3.5 text-amber-600" />
            <span>Cần duyệt</span>
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
              {totalApprovals > 99 ? '99+' : totalApprovals}
            </span>
          </Link>
        )}
        {canSubmit && (
          <div className="hidden sm:flex items-center gap-2">
            <Link
              href="/leave/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#005a3c] hover:bg-[#044e3f] text-white shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nghỉ phép</span>
            </Link>
            <Link
              href="/out-office/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Ra ngoài</span>
            </Link>
          </div>
        )}

        {/* User profile shortcut */}
        {user.role !== 'ACCOUNTANT' && (
          <Link
            href="/profile"
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
            title="Xem hồ sơ tài khoản"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#005a3c] border border-emerald-200 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left hidden xl:block">
              <p className="text-xs font-semibold text-slate-900 leading-tight">
                {user.full_name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-block px-1.5 py-0.2 text-[9px] font-semibold rounded border ${
                    roleBadgeColors[user.role] || 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {user.position || 'Chưa cập nhật chức vụ'}
                </span>
                {user.department_name && (
                  <span className="text-[11px] text-slate-500 truncate max-w-[130px]">
                    • {user.department_name}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )}

        <div className="h-6 w-px bg-slate-200"></div>

        <LogoutButton />
      </div>
    </header>
  );
}
