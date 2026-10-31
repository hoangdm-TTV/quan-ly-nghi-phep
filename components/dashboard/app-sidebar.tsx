"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SafeUser } from "@/lib/types/user";
import {
  canAccessRequestModules,
  canApproveWorkflowRequests,
  canApproveOutOfficeRequests,
  canSubmitPersonalRequests,
  canViewRequestScope,
  canManageHolidays,
} from "@/lib/auth/roles";
import { canManageHr } from "@/lib/auth/admin-account";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  CheckSquare,
  CheckCheck,
  UserCheck,
  FileText,
  ChevronDown,
  CalendarCheck,
  FolderOpen,
  UsersRound,
} from "lucide-react";
import BrandLogo from "@/components/brand/brand-logo";
import UserAvatar from "@/components/profile/user-avatar";

interface AppSidebarProps {
  user: SafeUser;
  approvalCounts: {
    leave: number;
    outOffice: number;
  };
  isOpen: boolean;
  onClose: () => void;
}

interface NavLeaf {
  kind: "leaf";
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
  badge?: number;
}

interface NavGroup {
  kind: "group";
  id: string;
  name: string;
  icon: typeof LayoutDashboard;
  show: boolean;
  children: NavChild[];
}

type NavItem = NavLeaf | NavGroup;

function isPathActive(
  pathname: string,
  href: string,
  exact = false,
  currentParams?: URLSearchParams,
) {
  const [routePath, query] = href.split("?");
  const routeMatches = exact
    ? pathname === routePath
    : pathname === routePath || pathname.startsWith(`${routePath}/`);
  if (!routeMatches) return false;
  if (!query) return true;
  return Array.from(new URLSearchParams(query).entries()).every(
    ([key, value]) => currentParams?.get(key) === value,
  );
}

export default function AppSidebar({
  user,
  approvalCounts,
  isOpen,
  onClose,
}: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canSubmit = canSubmitPersonalRequests(user.role);
  const canApprove = canApproveWorkflowRequests(user.role);
  const canApproveOutOffice = canApproveOutOfficeRequests(user.role);
  const canTrackScope = canViewRequestScope(user.role);
  const canUseRequests = canAccessRequestModules(user.role);
  const canManageHolidaysForRole = canManageHolidays(user.role);

  const navigation: NavItem[] = [
    {
      kind: "leaf",
      name: "Tổng quan",
      href: "/",
      icon: LayoutDashboard,
      show: true,
      exact: true,
    },
    {
      kind: "group",
      id: "leave",
      name: "Nghỉ phép",
      icon: CalendarDays,
      show: canUseRequests,
      children: [
        {
          name: "Đơn của tôi",
          href: canTrackScope ? "/leave?tab=mine" : "/leave",
          icon: FileText,
          show: canSubmit,
        },
        {
          name:
            user.role === "MANAGER"
              ? "Đơn phòng ban"
              : user.role === "TEAM_LEAD"
                ? "Đơn trong team"
                : "Toàn bộ đơn công ty",
          href: "/leave?tab=scope",
          icon: FolderOpen,
          show: canTrackScope,
        },
        {
          name: "Duyệt đơn nghỉ phép",
          href: "/approvals/leave",
          icon: CheckSquare,
          show: canApprove,
          badge: approvalCounts.leave,
        },
      ],
    },
    {
      kind: "group",
      id: "out-office",
      name: "Ra ngoài",
      icon: Clock,
      show: canUseRequests,
      children: [
        {
          name: "Đơn của tôi",
          href: canTrackScope ? "/out-office?tab=mine" : "/out-office",
          icon: FileText,
          show: canSubmit,
        },
        {
          name:
            user.role === "MANAGER"
              ? "Đơn phòng ban"
              : user.role === "TEAM_LEAD"
                ? "Đơn trong team"
                : "Toàn bộ đơn công ty",
          href: "/out-office?tab=scope",
          icon: FolderOpen,
          show: canTrackScope,
        },
        {
          name: "Duyệt đơn ra ngoài",
          href: "/approvals/out-office",
          icon: CheckCheck,
          show: canApproveOutOffice,
          badge: approvalCounts.outOffice,
        },
      ],
    },
    {
      kind: "leaf",
      name: "Quản lý ngày lễ",
      href: "/holidays",
      icon: CalendarCheck,
      show: canManageHolidaysForRole,
      exact: true,
    },
    {
      kind: "leaf",
      name: "Quản trị nhân sự",
      href: "/admin/hr",
      icon: UsersRound,
      show: canManageHr(user),
      exact: false,
    },
    {
      kind: "leaf",
      name: "Hồ sơ tài khoản",
      href: "/profile",
      icon: UserCheck,
      show: user.role !== "ACCOUNTANT",
      exact: true,
    },
  ];

  const visibleItems = navigation
    .map((item) => {
      if (item.kind === "leaf") return item;
      return { ...item, children: item.children.filter((child) => child.show) };
    })
    .filter(
      (item) => item.show && (item.kind === "leaf" || item.children.length > 0),
    );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of visibleItems) {
      if (item.kind === "group") {
        initial[item.id] = true;
      }
    }
    return initial;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of visibleItems) {
        if (
          item.kind === "group" &&
          item.children.some((child) =>
            isPathActive(pathname, child.href, false, searchParams),
          )
        ) {
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
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 border-r border-slate-200 bg-white text-slate-700 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 shadow-sm ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header - The ONLY main brand logo in desktop view */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-200/90 bg-white">
          <BrandLogo
            size="md"
            subtitle="Quản lý nghỉ phép & đơn ra ngoài"
            showBadge={true}
            href="/"
          />
        </div>

        {/* User Card - Clear, readable, comfortable */}
        <div className="p-3.5 mx-3.5 my-3 bg-gradient-to-br from-slate-50 to-slate-100/70 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-3">
            <UserAvatar
              userId={user.id}
              name={user.full_name}
              className="h-10 w-10 rounded-full border border-emerald-200 bg-emerald-100 text-sm text-[#005a3c] shadow-xs"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                {user.full_name}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-white text-[#005a3c] border border-emerald-200 shadow-2xs">
                  {user.position || "Chưa cập nhật chức vụ"}
                </span>
                {user.department_name && (
                  <span className="text-xs text-slate-600 truncate font-medium">
                    • {user.department_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items - Larger, readable text (text-sm), high contrast */}
        <nav className="flex-1 px-3.5 py-1 space-y-1.5 overflow-y-auto">
          <p className="px-3 pt-1 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Hệ thống quản lý
          </p>

          {visibleItems.map((item) => {
            if (item.kind === "leaf") {
              const isActive = isPathActive(
                pathname,
                item.href,
                item.exact,
                searchParams,
              );
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-[#005a3c] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-500"}`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            }

            const visibleChildren = item.children;
            const groupActive = visibleChildren.some((child) =>
              isPathActive(pathname, child.href, false, searchParams),
            );
            const isOpenGroup = openGroups[item.id] ?? groupActive;
            const GroupIcon = item.icon;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    groupActive
                      ? "bg-emerald-50/70 text-[#005a3c]"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  aria-expanded={isOpenGroup}
                >
                  <GroupIcon
                    className={`w-5 h-5 shrink-0 ${groupActive ? "text-[#005a3c]" : "text-slate-500"}`}
                  />
                  <span className="flex-1 text-left">{item.name}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isOpenGroup ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>

                {isOpenGroup && (
                  <div className="ml-4 pl-3.5 border-l-2 border-emerald-200/60 space-y-1 my-1">
                    {visibleChildren.map((child) => {
                      const isActive = isPathActive(
                        pathname,
                        child.href,
                        false,
                        searchParams,
                      );
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            isActive
                              ? "bg-emerald-100/70 text-[#005a3c] font-bold border-l-3 border-[#005a3c]"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <ChildIcon
                            className={`w-4 h-4 shrink-0 ${isActive ? "text-[#005a3c]" : "text-slate-400"}`}
                          />
                          <span className="flex-1">{child.name}</span>
                          {child.badge !== undefined && child.badge > 0 && (
                            <span
                              className="min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white shadow-sm"
                              aria-label={`${child.badge} đơn cần xử lý`}
                            >
                              {child.badge > 99 ? "99+" : child.badge}
                            </span>
                          )}
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
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-medium text-slate-700">
              Tri Thức Việt Portal
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded">
            v1.2
          </span>
        </div>
      </aside>
    </>
  );
}
