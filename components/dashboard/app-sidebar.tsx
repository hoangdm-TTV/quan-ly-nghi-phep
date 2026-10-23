'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SafeUser } from '@/lib/types/user';
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  CheckSquare,
  CheckCheck,
  UserCheck,
  X,
  ShieldCheck,
} from 'lucide-react';

interface AppSidebarProps {
  user: SafeUser;
  isOpen: boolean;
  onClose: () => void;
}

export default function AppSidebar({ user, isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();

  const canApproveLeave =
    user.role === 'TEAM_LEAD' || user.role === 'MANAGER' || user.role === 'DIRECTOR';

  const canApproveOutOffice =
    user.role === 'ACCOUNTANT' || user.role === 'DIRECTOR';

  const navigation = [
    {
      name: 'Tổng quan',
      href: '/',
      icon: LayoutDashboard,
      show: true,
      exact: true,
    },
    {
      name: 'Đơn nghỉ phép',
      href: '/leave',
      icon: CalendarDays,
      show: user.role !== 'DIRECTOR',
      exact: false,
    },
    {
      name: 'Đơn xin ra ngoài',
      href: '/out-office',
      icon: Clock,
      show: user.role !== 'DIRECTOR',
      exact: false,
    },
    {
      name: 'Duyệt đơn nghỉ phép',
      href: '/approvals/leave',
      icon: CheckSquare,
      show: canApproveLeave,
      exact: false,
      badgeColor: 'bg-purple-100 text-purple-700',
    },
    {
      name: 'Duyệt đơn ra ngoài',
      href: '/approvals/out-office',
      icon: CheckCheck,
      show: canApproveOutOffice,
      exact: false,
      badgeColor: 'bg-amber-100 text-amber-700',
    },
    {
      name: 'Hồ sơ tài khoản',
      href: '/profile',
      icon: UserCheck,
      show: true,
      exact: true,
    },
  ];

  return (
    <>
      {/* Overlay cho mobile */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand logo & title */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              LP
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight">Leave & Gate Pass</span>
              <p className="text-[10px] text-slate-400">Enterprise Management</p>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white lg:hidden rounded-md hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User preview snippet */}
        <div className="p-4 mx-3 my-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/30">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {user.role}
                </span>
                {user.department_name && (
                  <span className="text-[10px] text-slate-400 truncate">
                    • {user.department_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Menu navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Danh mục làm việc
          </p>

          {navigation
            .filter((item) => item.show)
            .map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Phiên bản v1.0.0</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Trực tuyến
          </span>
        </div>
      </aside>
    </>
  );
}
