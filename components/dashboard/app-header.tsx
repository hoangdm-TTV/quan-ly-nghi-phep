'use client';

import { SafeUser } from '@/lib/types/user';
import LogoutButton from '@/components/logout-button';
import Link from 'next/link';
import { Menu, UserCheck, ShieldCheck } from 'lucide-react';
import { getRoleLabel, getRoleBadgeClass } from '@/lib/auth/role-labels';
import { UserRole } from '@/lib/types/user';

interface AppHeaderProps {
  user: SafeUser;
  onOpenSidebar: () => void;
}

export default function AppHeader({ user, onOpenSidebar }: AppHeaderProps) {
  const roleBadgeColors: Record<string, string> = {
    DIRECTOR: 'bg-teal-100 text-teal-800 border-teal-200',
    MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
    TEAM_LEAD: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    ACCOUNTANT: 'bg-amber-100 text-amber-800 border-amber-200',
    STAFF: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          aria-label="Mở menu"
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg lg:hidden hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-slate-800">
            Hệ thống Quản lý Nghỉ phép & Đơn ra ngoài
          </h1>
          <p className="text-[11px] text-slate-400">Cổng thông tin nhân sự nội bộ</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* User shortcut */}
        {user.role !== 'ACCOUNTANT' && (
        <Link
          href="/profile"
          className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
          title="Xem hồ sơ tài khoản"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
            {user.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {user.full_name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span
                className={`inline-block px-1.5 py-0.2 text-[9px] font-semibold rounded border ${
                  roleBadgeColors[user.role] || 'bg-slate-100 text-slate-700'
                }`}
              >
                {getRoleLabel(user.role as UserRole)}
              </span>
              {user.department_name && (
                <span className="text-[10px] text-slate-500">
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
