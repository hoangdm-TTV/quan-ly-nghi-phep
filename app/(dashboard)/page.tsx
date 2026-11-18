import { requireAuth } from "@/lib/auth/permissions";
import {
  getDashboardStats,
  getRecentActivities,
  getScopeReport,
  getHrAdvancedReport,
  getAbsenceTrend,
  type DashboardStats,
  type ScopeReport,
  type RecentActivityItem,
  type HrAdvancedReport,
  type AbsenceTrendItem,
  type AbsenceTrendGrouping,
} from "@/lib/dashboard/queries";
import { getUserDataScopeLabel } from "@/lib/auth/data-scope";
import { getPendingLeaveRequestsForApprover } from "@/lib/leave/queries";
import { getPendingOutOfficeRequestsForApprover } from "@/lib/out-office/queries";
import {
  canApproveOutOfficeRequests,
  canSubmitPersonalRequests,
} from "@/lib/auth/roles";
import { getAbsenceCalendar } from "@/lib/dashboard/calendar";
import AbsenceCalendar from "@/components/dashboard/absence-calendar";
import AdvancedReportSection from "@/components/dashboard/advanced-report-section";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  CalendarDays,
  Plus,
  AlertCircle,
} from "lucide-react";

function validDateFilter(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10) === value ? value : undefined;
}

function getVietnamDateParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

const emptyStats: DashboardStats = {
  myLeaveTotal: 0,
  myLeavePending: 0,
  myLeaveApproved: 0,
  myLeaveRejected: 0,
  myOutOfficeTotal: 0,
  myOutOfficePending: 0,
  myOutOfficeActive: 0,
  myOutOfficeCompleted: 0,
};

const emptyReport: ScopeReport = {
  departments: [],
  totals: {
    leaveTotal: 0,
    leaveEmployees: 0,
    leavePending: 0,
    leaveApproved: 0,
    leaveRejected: 0,
    leaveCancelled: 0,
    leaveDays: 0,
    outOfficeTotal: 0,
    outOfficeEmployees: 0,
    outOfficePending: 0,
    outOfficeApproved: 0,
    outOfficeCompleted: 0,
    outOfficeRejected: 0,
    outOfficeCancelled: 0,
    outOfficeHours: 0,
  },
};

const emptyAdvancedReport: HrAdvancedReport = {
  topLeaveEmployees: [],
  longLeaveCount: 0,
  longLeaveRequests: [],
  lateOutOfficeDetails: [],
  lateOutOfficeReturns: 0,
  actualTracking: { completedCount: 0, onTimeCount: 0, lateCount: 0 },
};

const statusLabels: Record<string, { label: string; class: string }> = {
  PENDING: {
    label: "Chờ duyệt",
    class: "bg-amber-50 text-amber-800 border-amber-200",
  },
  APPROVED_BY_LEAD: {
    label: "Chờ Giám đốc",
    class: "bg-blue-50 text-blue-800 border-blue-200",
  },
  WAITING_FOR_DOC: {
    label: "Chờ nộp giấy",
    class: "bg-violet-50 text-violet-800 border-violet-200",
  },
  APPROVED: {
    label: "Đã duyệt",
    class: "bg-emerald-50 text-[#005a3c] border-emerald-200",
  },
  COMPLETED: {
    label: "Hoàn tất",
    class: "bg-emerald-50 text-[#005a3c] border-emerald-200",
  },
  REJECTED: {
    label: "Từ chối",
    class: "bg-rose-50 text-rose-800 border-rose-200",
  },
  CANCELLED: {
    label: "Đã hủy",
    class: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusLabels[status] || {
    label: status,
    class: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.class}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {cfg.label}
    </span>
  );
}

function SectionHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200/90">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          {title}
        </h2>
        {detail && (
          <p className="text-xs sm:text-sm text-slate-500">{detail}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function ReportSection({
  report,
  scopeLabel,
  longLeaveCount,
  reportFrom,
  reportTo,
}: {
  report: ScopeReport;
  scopeLabel: string;
  longLeaveCount: number;
  reportFrom?: string;
  reportTo?: string;
}) {
  const { totals } = report;
  const leaveDetailsHref = (longLeaveOnly = false) => {
    const params = new URLSearchParams({
      type: "leave",
      status: "APPROVED_GROUP",
      scope: "report",
    });
    if (reportFrom) params.set("from", reportFrom);
    if (reportTo) params.set("to", reportTo);
    if (longLeaveOnly) params.set("long", "1");
    return `/dashboard/details?${params.toString()}`;
  };
  const averageLeaveDays = totals.leaveApproved
    ? totals.leaveDays / totals.leaveApproved
    : 0;
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">
            Tổng quan
          </h1>
          <p className="text-xs text-slate-500 sm:text-sm">
            Tình hình nghỉ phép và ra ngoài theo kỳ · {scopeLabel}
          </p>
        </div>
        <form
          method="get"
          className="flex flex-wrap items-end gap-2"
          aria-label="Lọc kỳ báo cáo trên trang tổng quan"
        >
          <label className="block text-[10px] font-semibold text-slate-500">
            Kỳ báo cáo
            <input
              type="date"
              name="from"
              defaultValue={reportFrom}
              aria-label="Từ ngày"
              className="mt-1 block text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            />
          </label>
          <span className="pb-2 text-xs text-slate-400">→</span>
          <label className="block text-[10px] font-semibold text-slate-500">
            Đến ngày
            <input
              type="date"
              name="to"
              defaultValue={reportTo}
              aria-label="Đến ngày"
              className="mt-1 block text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            />
          </label>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-[#005a3c] text-white text-xs font-semibold hover:bg-[#044e3f] transition-colors"
          >
            Lọc
          </button>
          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors"
          >
            Xóa bộ lọc
          </Link>
        </form>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Nhân viên nghỉ",
            value: totals.leaveEmployees,
            detail: "người trong kỳ",
            color: "text-blue-600 bg-blue-50",
            href: leaveDetailsHref(),
          },
          {
            label: "Lượt nghỉ",
            value: totals.leaveApproved,
            detail: "đơn đã duyệt",
            color: "text-emerald-700 bg-emerald-50",
            href: leaveDetailsHref(),
          },
          {
            label: "Đơn nghỉ > 2 ngày",
            value: longLeaveCount,
            detail: "ngày làm việc",
            color: "text-amber-700 bg-amber-50",
            href: leaveDetailsHref(true),
          },
          {
            label: "Ngày nghỉ TB",
            value: Number(averageLeaveDays.toFixed(1)),
            detail: "trên mỗi đơn",
            color: "text-violet-700 bg-violet-50",
            href: leaveDetailsHref(),
          },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${item.color}`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 sm:text-3xl">
                  {item.value.toLocaleString("vi-VN")}
                </p>
                <p className="text-[11px] text-slate-500">{item.detail}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PersonalSummary({
  stats,
}: {
  stats: DashboardStats;
}) {
  return (
    <section className="space-y-4">
      <SectionHeading
        title="Đơn cá nhân của tôi"
        detail="Theo dõi nhanh tình trạng nghỉ phép và ra ngoài cá nhân"
        action={
          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold">
            <Link
              href="/leave?tab=mine"
              className="text-[#005a3c] hover:underline"
            >
              Xem đơn nghỉ phép →
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* KPI Card 1: Nghỉ phép */}
        <Link
          href="/dashboard/details?type=leave&scope=mine&status=ALL"
          className="group bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100/80 text-[#005a3c] border border-emerald-200 flex items-center justify-center shrink-0">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-[#005a3c] transition-colors">
                  Đơn nghỉ phép
                </h3>
                <p className="text-xs text-slate-500">
                  Số đơn đã tạo trong năm
                </p>
              </div>
            </div>
            <span className="text-3xl font-black text-slate-900 tabular-nums">
              {stats.myLeaveTotal}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {stats.myLeavePending} đang chờ
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-[#005a3c] border border-emerald-200">
                {stats.myLeaveApproved} đã duyệt
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#005a3c] group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        {/* KPI Card 2: Ra ngoài */}
        <Link
          href="/dashboard/details?type=out-office&scope=mine&status=ALL"
          className="group bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100/80 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Đơn ra ngoài
                </h3>
                <p className="text-xs text-slate-500">
                  Số lượt xin ra ngoài cổng
                </p>
              </div>
            </div>
            <span className="text-3xl font-black text-slate-900 tabular-nums">
              {stats.myOutOfficeTotal}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {stats.myOutOfficePending} đang chờ
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-[#005a3c] border border-emerald-200">
                {stats.myOutOfficeCompleted} hoàn tất
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>
    </section>
  );
}

function ApprovalQueue({
  leaveRequests,
  outOfficeRequests,
}: {
  leaveRequests: Array<{
    id: string;
    employee_name: string;
    start_date: string;
    end_date: string;
    duration_days: number;
  }>;
  outOfficeRequests: Array<{
    id: string;
    employee_name: string;
    request_date: string;
    start_time: string;
    end_time: string;
  }>;
}) {
  const leavePreview = leaveRequests.slice(0, 3);
  const outOfficePreview = outOfficeRequests.slice(0, 3);
  const total = leavePreview.length + outOfficePreview.length;
  if (total === 0) return null;

  return (
    <section className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white rounded-2xl p-5 sm:p-6 shadow-xs border border-amber-200/90 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Hàng đợi phê duyệt cần xử lý
            </h2>
            <p className="text-xs text-slate-600">
              Đang hiển thị tối đa 3 đơn mỗi loại; mở hàng đợi để xem toàn bộ.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {leavePreview.length > 0 && (
            <Link
              href="/approvals/leave"
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#005a3c] text-white hover:bg-[#044e3f] shadow-xs transition-colors"
            >
              Duyệt nghỉ phép
            </Link>
          )}
          {outOfficePreview.length > 0 && (
            <Link
              href="/approvals/out-office"
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-900 shadow-xs transition-colors"
            >
              Duyệt ra ngoài
            </Link>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 pt-1">
        {leavePreview.map((r) => (
          <Link
            key={r.id}
            href={`/leave/${r.id}`}
            className="p-3 bg-white rounded-xl border border-amber-200/70 hover:border-amber-400 hover:shadow-xs transition-all flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-bold text-slate-900">
                {r.employee_name}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Nghỉ phép: {r.start_date} → {r.end_date} ({r.duration_days}{" "}
                ngày)
              </p>
            </div>
            <span className="text-xs font-semibold text-[#005a3c] flex items-center gap-1">
              Xem đơn <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        ))}
        {outOfficePreview.map((r) => (
          <Link
            key={r.id}
            href={`/out-office/${r.id}`}
            className="p-3 bg-white rounded-xl border border-amber-200/70 hover:border-amber-400 hover:shadow-xs transition-all flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-bold text-slate-900">
                {r.employee_name}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ra ngoài: {r.request_date} ({r.start_time} - {r.end_time})
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
              Xem đơn <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PersonalActivity({
  activities,
}: {
  activities: RecentActivityItem[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Đơn của tôi</h2>
          <p className="text-xs text-slate-500">
            Theo dõi các đơn nghỉ phép và ra ngoài gần đây
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <Link
            href="/leave?tab=mine"
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50"
          >
            Xem đơn nghỉ phép
          </Link>
          <Link
            href="/out-office?tab=mine"
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50"
          >
            Xem đơn ra ngoài
          </Link>
        </div>
      </div>
      {activities.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-6 text-center text-xs text-slate-500">
          Chưa có đơn nào gần đây.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="border-y border-slate-100 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Loại đơn</th>
                <th className="px-3 py-3">Thời gian</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <td className="px-3 py-3 font-semibold text-slate-800">
                    <Link href={item.link} className="hover:underline">
                      {item.type === "LEAVE" ? "Nghỉ phép" : "Ra ngoài"}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    <span className="block">{item.dateInfo}</span>
                    <span className="block max-w-sm truncate text-[10px] text-slate-400">
                      {item.title}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                    {new Intl.DateTimeFormat("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Ho_Chi_Minh",
                    }).format(new Date(item.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; groupBy?: string };
}) {
  const user = await requireAuth();
  const todayParts = getVietnamDateParts();
  const currentDateVN = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const currentYearVN = todayParts.year;
  let reportFrom =
    validDateFilter(searchParams?.from) || `${currentYearVN}-01-01`;
  let reportTo = validDateFilter(searchParams?.to) || currentDateVN;
  if (reportFrom && reportTo && reportFrom > reportTo) {
    reportFrom = `${currentYearVN}-01-01`;
    reportTo = currentDateVN;
  }
  const groupBy: AbsenceTrendGrouping =
    searchParams?.groupBy === "day" ||
    searchParams?.groupBy === "year" ||
    searchParams?.groupBy === "month"
      ? searchParams.groupBy
      : "month";

  const isAccountant = user.role === "ACCOUNTANT";
  const isAdmin = user.role === "ADMIN";
  const isDirector = user.role === "DIRECTOR";
  const isManager = user.role === "MANAGER";
  const isTeamLead = user.role === "TEAM_LEAD";
  const isApprover = isManager || isDirector;
  const isOutOfficeApprover = canApproveOutOfficeRequests(user.role);
  const canSubmit = canSubmitPersonalRequests(user.role);
  const hasPersonalDashboard = canSubmit;
  const needsReport =
    isAdmin || isTeamLead || isManager || isDirector || isAccountant;
  const scopeLabel = getUserDataScopeLabel(user);
  const calendarFrom = `${currentDateVN.slice(0, 7)}-01`;
  const calendarTo = `${currentDateVN.slice(0, 7)}-${String(
    new Date(
      Date.UTC(
        Number(currentDateVN.slice(0, 4)),
        Number(currentDateVN.slice(5, 7)),
        0,
      ),
    ).getUTCDate(),
  ).padStart(2, "0")}`;
  const [
    stats,
    recentActivities,
    pendingLeaves,
    pendingOutOffices,
    scopeReport,
    advancedReport,
    absenceItems,
    trend,
  ] = await Promise.all([
    hasPersonalDashboard
      ? getDashboardStats(user, reportFrom, reportTo)
      : Promise.resolve(emptyStats),
    hasPersonalDashboard
      ? getRecentActivities(user)
      : Promise.resolve([] as RecentActivityItem[]),
    isApprover
      ? getPendingLeaveRequestsForApprover(user, { limit: 3, offset: 0 })
      : Promise.resolve([]),
    isOutOfficeApprover
      ? getPendingOutOfficeRequestsForApprover(user, { limit: 3, offset: 0 })
      : Promise.resolve([]),
    needsReport
      ? getScopeReport(user, reportFrom, reportTo)
      : Promise.resolve(emptyReport),
    needsReport
      ? getHrAdvancedReport(user, reportFrom, reportTo)
      : Promise.resolve(emptyAdvancedReport),
    !needsReport
      ? getAbsenceCalendar(user, calendarFrom, calendarTo)
      : Promise.resolve([]),
    needsReport
      ? getAbsenceTrend(user, reportFrom, reportTo, groupBy)
      : Promise.resolve([] as AbsenceTrendItem[]),
  ]);

  const roleDescription = isAccountant
    ? "Theo dõi dữ liệu toàn công ty · Chế độ chỉ đọc đối soát"
    : isAdmin
      ? "Quản trị tài khoản và hồ sơ nhân sự"
      : isDirector
        ? "Giám sát toàn công ty · Theo dõi và tạo đơn cá nhân"
        : isManager
          ? `Quản lý phê duyệt & Đơn phòng ban ${user.department_name || ""}`
          : "Cổng thông tin gửi đơn nghỉ phép & đơn ra ngoài cá nhân";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Hero Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900 via-[#005a3c] to-teal-800 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
                {user.position || "Chưa cập nhật chức vụ"}
              </span>
              {user.department_name && (
                <span className="text-xs text-emerald-100 font-medium">
                  {user.department_name}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Xin chào, {user.full_name}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-emerald-100 max-w-xl">
              {roleDescription}
            </p>
          </div>

          {canSubmit && (
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/leave/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#005a3c] font-bold text-xs sm:text-sm hover:bg-emerald-50 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo đơn nghỉ phép</span>
              </Link>
              <Link
                href="/out-office/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800/80 text-white border border-emerald-400/40 font-bold text-xs sm:text-sm hover:bg-emerald-800 transition-all"
              >
                <Clock className="w-4 h-4" />
                <span>Tạo đơn ra ngoài</span>
              </Link>
            </div>
          )}
        </div>

        {/* Subtle decorative background circles */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-36 -top-12 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {isAccountant && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-4 text-xs sm:text-sm text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Chế độ đối soát số liệu Kế toán</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Báo cáo bên dưới hiển thị số liệu tổng hợp toàn công ty. Để xem
              chi tiết từng đơn, hãy mở mục{" "}
              <Link href="/leave?tab=scope" className="font-semibold underline">
                Nghỉ phép
              </Link>{" "}
              hoặc{" "}
              <Link
                href="/out-office?tab=scope"
                className="font-semibold underline"
              >
                Ra ngoài
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Reports if manager/director/accountant */}
      {needsReport && (
        <ReportSection
          report={scopeReport}
          scopeLabel={scopeLabel}
          longLeaveCount={advancedReport.longLeaveCount}
          reportFrom={reportFrom}
          reportTo={reportTo}
        />
      )}

      {needsReport && (
        <AdvancedReportSection
          report={advancedReport}
          scopeReport={scopeReport}
          trend={trend}
          trendGrouping={groupBy}
          reportFrom={reportFrom}
          reportTo={reportTo}
        />
      )}

      {/* Approvals Queue if approver */}
      {(isApprover || isOutOfficeApprover) && (
        <ApprovalQueue
          leaveRequests={pendingLeaves}
          outOfficeRequests={pendingOutOffices}
        />
      )}

      {!needsReport && <AbsenceCalendar items={absenceItems} />}

      {/* Personal KPI stats */}
      {hasPersonalDashboard && !needsReport && (
        <PersonalSummary stats={stats} />
      )}

      {/* Recent activities */}
      {hasPersonalDashboard && (
        <PersonalActivity activities={recentActivities} />
      )}
    </div>
  );
}
