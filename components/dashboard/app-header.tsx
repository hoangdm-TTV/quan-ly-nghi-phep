'use client';

import { SafeUser } from '@/lib/types/user';
import LogoutButton from '@/components/logout-button';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { getRoleLabel } from '@/lib/auth/role-labels';
import { UserRole } from '@/lib/types/user';
import BrandLogo from '@/components/brand/brand-logo';

interface AppHeaderProps {
  user: SafeUser;
  onOpenSidebar: () => void;
}

export default function AppHeader({ user, onOpenSidebar }: AppHeaderProps) {
  const roleBadgeColors: Record<string, string> = {
    DIRECTOR: 'bg-teal-50 text-teal-700 border-teal-200',
    MANAGER: 'bg-blue-50 text-blue-700 border-blue-200',
    TEAM_LEAD: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    ACCOUNTANT: 'bg-amber-50 text-amber-700 border-amber-200',
    STAFF: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <header className="sticky top-0 z-30 min-h-[72px] sm:min-h-[76px] bg-white border-b border-slate-200/90 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenSidebar}
          aria-label="Mở menu"
          className="p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg lg:hidden hover:bg-slate-100 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Header matching reference style */}
        <BrandLogo
          size="md"
          subtitle="Quản lý nghỉ phép & đơn ra ngoài"
          showBadge={true}
        />
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* User profile shortcut */}
        {user.role !== 'ACCOUNTANT' && (
          <Link
            href="/profile"
            className="flex items-center gap-2.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/70 transition-all"
            title="Xem hồ sơ tài khoản"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-100/80 text-[#005a3c] border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-900 leading-tight">
                {user.full_name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded-md border ${
                    roleBadgeColors[user.role] || 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {getRoleLabel(user.role as UserRole)}
                </span>
                {user.department_name && (
                  <span className="text-[11px] text-slate-500 truncate max-w-[120px]">
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
