'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SafeUser } from '@/lib/types/user';
import {
  canAccessRequestModules,
  canApproveWorkflowRequests,
  canSubmitPersonalRequests,
} from '@/lib/auth/roles';
import { getRoleLabel } from '@/lib/auth/role-labels';
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  CheckSquare,
  CheckCheck,
  UserCheck,
  FileText,
  X,
  ChevronDown,
  CalendarCheck,
} from 'lucide-react';

interface AppSidebarProps {
  user: SafeUser;
  isOpen: boolean;
  onClose: () => void;
}

interface NavLeaf {
  kind: 'leaf';
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  show: boolean;
  exact?: boolean;
}

interface NavChild {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  show: boolean;
}

interface NavGroup {
  kind: 'group';
  id: string;
  name: string;
  icon: typeof LayoutDashboard;
  show: boolean;
  children: NavChild[];
}

type NavItem = NavLeaf | NavGroup;

function isPathActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppSidebar({ user, isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const canSubmit = canSubmitPersonalRequests(user.role);
  const canApprove = canApproveWorkflowRequests(user.role);
  const canUseRequests = canAccessRequestModules(user.role);
  const canManageHolidays = user.role === 'ACCOUNTANT' || user.role === 'DIRECTOR';

  const navigation: NavItem[] = [
    {
      kind: 'leaf',
      name: 'Tổng quan',
      href: '/',
      icon: LayoutDashboard,
      show: true,
      exact: true,
    },
    {
      kind: 'group',
      id: 'leave',
      name: 'Nghỉ phép',
      icon: CalendarDays,
      show: canUseRequests,
      children: [
        {
          name: canSubmit ? 'Đơn của tôi' : 'Đơn nghỉ phép',
          href: '/leave',
          icon: FileText,
          show: true,
        },
        {
          name: 'Duyệt đơn nghỉ phép',
          href: '/approvals/leave',
          icon: CheckSquare,
          show: canApprove,
        },
      ],
    },
    {
      kind: 'group',
      id: 'out-office',
      name: 'Ra ngoài',
      icon: Clock,
      show: canUseRequests,
      children: [
        {
          name: canSubmit ? 'Đơn của tôi' : 'Đơn ra ngoài',
          href: '/out-office',
          icon: FileText,
          show: true,
        },
        {
          name: 'Duyệt đơn ra ngoài',
          href: '/approvals/out-office',
          icon: CheckCheck,
          show: canApprove,
        },
      ],
    },
    {
      kind: 'leaf',
      name: 'Quản lý ngày lễ',
      href: '/holidays',
      icon: CalendarCheck,
      show: canManageHolidays,
      exact: true,
    },
    {
      kind: 'leaf',
      name: 'Hồ sơ tài khoản',
      href: '/profile',
      icon: UserCheck,
      show: canUseRequests,
      exact: true,
    },
  ];

  const visibleItems = navigation
    .map((item) => {
      if (item.kind === 'leaf') return item;
      return { ...item, children: item.children.filter((child) => child.show) };
    })
    .filter((item) => item.show && (item.kind === 'leaf' || item.children.length > 0));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of visibleItems) {
      if (item.kind === 'group') {
        initial[item.id] = true;
      }
    }
    return initial;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of visibleItems) {
        if (item.kind === 'group' && item.children.some((child) => isPathActive(pathname, child.href))) {
          next[item.id] = true;
        }
      }
      return next;
    });
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
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

        <div className="p-4 mx-3 my-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/30">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block px-1.5 py-0.2 text-[9px] font-semibold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {getRoleLabel(user.role)}
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

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Danh mục làm việc
          </p>

          {visibleItems.map((item) => {
            if (item.kind === 'leaf') {
              const isActive = isPathActive(pathname, item.href, item.exact);
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
            }

            const visibleChildren = item.children;
            const groupActive = visibleChildren.some((child) => isPathActive(pathname, child.href));
            const isOpenGroup = openGroups[item.id] ?? groupActive;
            const GroupIcon = item.icon;

            return (
              <div key={item.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    groupActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  aria-expanded={isOpenGroup}
                >
                  <GroupIcon className={`w-4 h-4 ${groupActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="flex-1 text-left">{item.name}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                      isOpenGroup ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>

                {isOpenGroup && (
                  <div className="ml-4 pl-3 border-l border-slate-700/80 space-y-0.5">
                    {visibleChildren.map((child) => {
                      const isActive = isPathActive(pathname, child.href);
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-xs'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <ChildIcon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                          <span>{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

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
