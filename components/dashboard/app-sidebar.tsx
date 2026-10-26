'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { SafeUser } from '@/lib/types/user';
import {
  canAccessRequestModules,
  canApproveWorkflowRequests,
  canSubmitPersonalRequests,
  canViewRequestScope,
  canManageHolidays,
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
import BrandLogo from '@/components/brand/brand-logo';

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

function isPathActive(pathname: string, href: string, exact = false, currentParams?: URLSearchParams) {
  const [routePath, query] = href.split('?');
  const routeMatches = exact
    ? pathname === routePath
    : pathname === routePath || pathname.startsWith(`${routePath}/`);
  if (!routeMatches) return false;
  if (!query) return true;
  return Array.from(new URLSearchParams(query).entries()).every(([key, value]) => currentParams?.get(key) === value);
}

export default function AppSidebar({ user, isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canSubmit = canSubmitPersonalRequests(user.role);
  const canApprove = canApproveWorkflowRequests(user.role);
  const canTrackScope = canViewRequestScope(user.role);
  const canUseRequests = canAccessRequestModules(user.role);
  const canManageHolidaysForRole = canManageHolidays(user.role);

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
          name: 'Đơn của tôi',
          href: canTrackScope ? '/leave?tab=mine' : '/leave',
          icon: FileText,
          show: canSubmit,
        },
        {
          name: user.role === 'MANAGER' ? 'Đơn phòng ban' : 'Toàn bộ đơn công ty',
          href: '/leave?tab=scope',
          icon: FileText,
          show: canTrackScope,
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
          name: 'Đơn của tôi',
          href: canTrackScope ? '/out-office?tab=mine' : '/out-office',
          icon: FileText,
          show: canSubmit,
        },
        {
          name: user.role === 'MANAGER' ? 'Đơn phòng ban' : 'Toàn bộ đơn công ty',
          href: '/out-office?tab=scope',
          icon: FileText,
          show: canTrackScope,
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
      show: canManageHolidaysForRole,
      exact: true,
    },
    {
      kind: 'leaf',
      name: 'Hồ sơ tài khoản',
      href: '/profile',
      icon: UserCheck,
      show: canUseRequests && user.role !== 'ACCOUNTANT',
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
        if (item.kind === 'group' && item.children.some((child) => isPathActive(pathname, child.href, false, searchParams))) {
          next[item.id] = true;
        }
      }
      return next;
    });
  }, [pathname, searchParams]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 border-r border-slate-200/90 bg-white text-slate-700 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 shadow-sm ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="min-h-[72px] sm:min-h-[76px] flex items-center justify-between px-4 border-b border-slate-200/90">
          <BrandLogo
            size="sm"
            subtitle="Nghỉ phép & Đơn ra ngoài"
            showBadge={true}
            href="/"
          />

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 lg:hidden rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-3 mx-3 my-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#005a3c] border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-white text-slate-700 border border-slate-200">
                  {getRoleLabel(user.role)}
                </span>
                {user.department_name && (
                  <span className="text-[10px] text-slate-500 truncate">
                    • {user.department_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Hệ thống quản lý
          </p>

          {visibleItems.map((item) => {
            if (item.kind === 'leaf') {
              const isActive = isPathActive(pathname, item.href, item.exact, searchParams);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-50/80 text-[#005a3c] font-semibold border border-emerald-200/60 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#005a3c]' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            }

            const visibleChildren = item.children;
            const groupActive = visibleChildren.some((child) => isPathActive(pathname, child.href, false, searchParams));
            const isOpenGroup = openGroups[item.id] ?? groupActive;
            const GroupIcon = item.icon;

            return (
              <div key={item.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    groupActive
                      ? 'bg-slate-50 text-slate-900 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                  aria-expanded={isOpenGroup}
                >
                  <GroupIcon className={`w-4 h-4 ${groupActive ? 'text-[#005a3c]' : 'text-slate-400'}`} />
                  <span className="flex-1 text-left">{item.name}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      isOpenGroup ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>

                {isOpenGroup && (
                  <div className="ml-4 pl-3 border-l-2 border-slate-100 space-y-0.5">
                    {visibleChildren.map((child) => {
                      const isActive = isPathActive(pathname, child.href, false, searchParams);
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all ${
                            isActive
                              ? 'bg-emerald-50 text-[#005a3c] font-semibold'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                          }`}
                        >
                          <ChildIcon className={`w-3.5 h-3.5 ${isActive ? 'text-[#005a3c]' : 'text-slate-400'}`} />
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

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-slate-200/90 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Tri Thức Việt © 2026</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono">v1.2</span>
        </div>
      </aside>
    </>
  );
}
