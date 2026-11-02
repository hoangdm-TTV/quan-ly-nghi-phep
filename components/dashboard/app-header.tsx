"use client";

import { useState } from "react";
import { SafeUser } from "@/lib/types/user";
import LogoutButton from "@/components/logout-button";
import Link from "next/link";
import { Menu, Plus, Clock, UserCheck, ChevronDown } from "lucide-react";
import { canSubmitPersonalRequests } from "@/lib/auth/roles";
import BrandLogo from "@/components/brand/brand-logo";
import PushNotificationSetup from "@/components/notifications/push-notification-setup";
import UserAvatar from "@/components/profile/user-avatar";
import NotificationBell from "@/components/notifications/notification-bell";

interface AppHeaderProps {
  user: SafeUser;
  approvalCounts: {
    leave: number;
    outOffice: number;
  };
  onOpenSidebar: () => void;
}

export default function AppHeader({ user, approvalCounts: _approvalCounts, onOpenSidebar }: AppHeaderProps) {
  const canSubmit = canSubmitPersonalRequests(user.role);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const roleBadgeColors: Record<string, string> = {
    DIRECTOR: "bg-teal-50 text-teal-800 border-teal-200",
    MANAGER: "bg-blue-50 text-blue-800 border-blue-200",
    TEAM_LEAD: "bg-emerald-50 text-emerald-800 border-emerald-200",
    ACCOUNTANT: "bg-amber-50 text-amber-800 border-amber-200",
    ADMIN: "bg-violet-50 text-violet-800 border-violet-200",
    STAFF: "bg-slate-100 text-slate-800 border-slate-200",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-xs sm:px-6 lg:px-8">
      {/* Mobile: chỉ giữ menu, logo gọn và tên thương hiệu ngắn */}
      <div className="flex min-w-0 items-center gap-2 lg:hidden">
        <button
          onClick={onOpenSidebar}
          aria-label="Mở menu"
          className="-ml-2 rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Menu className="h-5 w-5" />
        </button>
        <BrandLogo size="sm" subtitle="" showBadge={false} logoOnly />
        <span className="max-w-[150px] text-xs font-bold leading-tight text-slate-800">
          Quản lý nghỉ phép &amp; đơn ra ngoài
        </span>
      </div>

      {/* Desktop: giữ nguyên tiêu đề hệ thống */}
      <div className="hidden items-center gap-4 lg:flex">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">
              Cổng Quản lý Nghỉ phép & Đơn ra ngoài
            </span>
            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#005a3c]">
              TRI THỨC VIỆT
            </span>
          </div>
          <p className="text-xs text-slate-500">Hệ thống quy trình nhân sự & phê duyệt trực tuyến</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-4">
        {/* Web Push nằm trên desktop; mobile đưa vào menu avatar */}
        <div className="hidden lg:block">
          <PushNotificationSetup />
        </div>
        {/* Chỉ giữ một chuông thông báo nội bộ trên mọi kích thước */}
        <NotificationBell />

        {canSubmit && (
          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/leave/new" className="inline-flex items-center gap-1.5 rounded-lg bg-[#005a3c] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#044e3f]">
              <Plus className="h-3.5 w-3.5" />
              <span>Nghỉ phép</span>
            </Link>
            <Link href="/out-office/new" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Ra ngoài</span>
            </Link>
          </div>
        )}

        {/* Profile chip trên desktop */}
        {user.role !== "ACCOUNTANT" && (
          <Link href="/profile" className="hidden items-center gap-2.5 rounded-xl border border-transparent p-1.5 transition-all hover:border-slate-200 hover:bg-slate-50 lg:flex" title="Xem hồ sơ tài khoản">
            <UserAvatar userId={user.id} name={user.full_name} className="h-8 w-8 rounded-full border border-emerald-200 bg-emerald-100 text-xs text-[#005a3c] shadow-2xs" />
            <div className="hidden text-left xl:block">
              <p className="leading-tight text-xs font-semibold text-slate-900">{user.full_name}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className={`inline-block rounded border px-1.5 py-0.2 text-[9px] font-semibold ${roleBadgeColors[user.role] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                  {user.position || "Chưa cập nhật chức vụ"}
                </span>
                {user.department_name && <span className="max-w-[130px] truncate text-[11px] text-slate-500">• {user.department_name}</span>}
              </div>
            </div>
          </Link>
        )}

        <div className="hidden h-6 w-px bg-slate-200 lg:block" />
        <div className="hidden lg:block">
          <LogoutButton />
        </div>

        {/* Mobile: avatar mở menu hồ sơ, bật thông báo và đăng xuất */}
        <div className="relative lg:hidden">
          <button
            type="button"
            aria-label="Mở menu tài khoản"
            aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((value) => !value)}
            className="flex items-center gap-1 rounded-full p-0.5 transition-colors hover:bg-slate-100"
          >
            <UserAvatar userId={user.id} name={user.full_name} className="h-9 w-9 rounded-full border border-emerald-200 bg-emerald-100 text-xs font-bold text-[#005a3c]" />
            <ChevronDown className={`hidden h-3.5 w-3.5 text-slate-500 min-[420px]:block ${profileMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {profileMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="border-b border-slate-100 px-3 pb-3 pt-2">
                <p className="truncate text-sm font-bold text-slate-900">{user.full_name}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{user.position || "Chưa cập nhật chức vụ"}</p>
              </div>
              {user.role !== "ACCOUNTANT" && (
                <Link href="/profile" onClick={() => setProfileMenuOpen(false)} className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <UserCheck className="h-4 w-4 text-[#005a3c]" /> Hồ sơ tài khoản
                </Link>
              )}
              <div className="border-t border-slate-100 px-3 py-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Thông báo trên thiết bị</p>
                <PushNotificationSetup alwaysShowLabel />
              </div>
              <div className="border-t border-slate-100 px-1 pt-2">
                <LogoutButton />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
