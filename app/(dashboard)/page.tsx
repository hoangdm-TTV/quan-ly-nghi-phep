import { requireAuth } from "@/lib/auth/permissions";
import {
  getDashboardStats,
  getRecentActivities,
  getScopeReport,
  getHrAdvancedReport,
  getScopeActivityFeed,
  type DashboardStats,
  type ScopeReport,
  type ScopeActivityItem,
  type RecentActivityItem,
  type HrAdvancedReport,
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
  FileText,
  Plus,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Building2,
  CalendarCheck2,
} from "lucide-react";

function validDateFilter(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10) === value ? value : undefined;
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
  pendingLeaveApprovals: 0,
  pendingOutOfficeApprovals: 0,
};

const emptyReport: ScopeReport = {
  departments: [],
  totals: {
    leaveTotal: 0,
    leavePending: 0,
    leaveApproved: 0,
    leaveRejected: 0,
    leaveCancelled: 0,
    leaveDays: 0,
    outOfficeTotal: 0,
    outOfficePending: 0,
    outOfficeApproved: 0,
    outOfficeCompleted: 0,
    outOfficeRejected: 0,
    outOfficeCancelled: 0,
    outOfficeHours: 0,
  },
};

const emptyAdvancedReport: HrAdvancedReport = {
  monthlyLeave: [],
  topLeaveEmployees: [],
  averageApprovalHours: 0,
  pendingByLevel: [],
  employeesWithoutEntitlement: 0,
  lateOutOfficeReturns: 0,
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
  reportFrom,
  reportTo,
  showDepartmentBreakdown,
}: {
  report: ScopeReport;
  scopeLabel: string;
  reportFrom?: string;
  reportTo?: string;
  showDepartmentBreakdown: boolean;
}) {
  const { totals } = report;
  return (
    <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/90 space-y-5">
      <SectionHeading
        title="Báo cáo thống kê tổng hợp"
        detail={`Phạm vi số liệu: ${scopeLabel}`}
        action={
          <form method="get" className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              name="from"
              defaultValue={reportFrom}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            />
            <span className="text-xs text-slate-400">→</span>
            <input
              type="date"
              name="to"
              defaultValue={reportTo}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            />
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
        }
      />

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-50/80 to-emerald-100/40 p-4 rounded-xl border border-emerald-200/80">
          <p className="text-xs font-bold text-[#005a3c] uppercase tracking-wider">
            Tổng đơn nghỉ phép
          </p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900">
            {totals.leaveTotal}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            <span className="font-semibold text-amber-700">
              {totals.leavePending} chờ
            </span>{" "}
            · {totals.leaveApproved} duyệt ·{" "}
            <span className="font-semibold text-rose-700">
              {totals.leaveRejected} từ chối
            </span>{" "}
            · {totals.leaveCancelled} hủy
          </p>
        </div>

        <div className="bg-gradient-to-br from-teal-50/80 to-teal-100/40 p-4 rounded-xl border border-teal-200/80">
          <p className="text-xs font-bold text-teal-800 uppercase tracking-wider">
            Tổng ngày nghỉ
          </p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900">
            {Number(totals.leaveDays.toFixed(1))}
          </p>
          <p className="mt-1 text-xs text-slate-600">Ngày làm việc</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/40 p-4 rounded-xl border border-blue-200/80">
          <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">
            Tổng đơn ra ngoài
          </p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900">
            {totals.outOfficeTotal}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            <span className="font-semibold text-amber-700">
              {totals.outOfficePending} chờ
            </span>{" "}
            · {totals.outOfficeCompleted} hoàn tất ·{" "}
            <span className="font-semibold text-rose-700">
              {totals.outOfficeRejected} từ chối
            </span>{" "}
            · {totals.outOfficeCancelled} hủy
          </p>
        </div>

        <div className="bg-gradient-to-br from-cyan-50/80 to-cyan-100/40 p-4 rounded-xl border border-cyan-200/80">
          <p className="text-xs font-bold text-cyan-800 uppercase tracking-wider">
            Tổng giờ ra ngoài
          </p>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900">
            {Number(totals.outOfficeHours.toFixed(1))}h
          </p>
          <p className="mt-1 text-xs text-slate-600">Giờ thực tế</p>
        </div>
      </div>

      {showDepartmentBreakdown && report.departments.length > 0 && (
        <div className="pt-2">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#005a3c]" />
            <span>Chi tiết theo phòng ban</span>
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Phòng ban</th>
                  <th className="py-3 px-3 text-right">Đơn nghỉ</th>
                  <th className="py-3 px-3 text-right">Ngày nghỉ</th>
                  <th className="py-3 px-3 text-right">Đơn ra ngoài</th>
                  <th className="py-3 px-4 text-right">Giờ ra ngoài</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.departments.map((dep) => (
                  <tr
                    key={dep.departmentName}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {dep.departmentName}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {dep.leaveTotal}{" "}
                      <span className="text-xs text-slate-400">
                        ({dep.leavePending} chờ)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {Number(dep.leaveDays.toFixed(1))}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                      {dep.outOfficeTotal}{" "}
                      <span className="text-xs text-slate-400">
                        ({dep.outOfficePending} chờ)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {Number(dep.outOfficeHours.toFixed(2))}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function PersonalSummary({
  stats,
  isManager,
}: {
  stats: DashboardStats;
  isManager: boolean;
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
          href="/leave?tab=mine"
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
          href="/out-office?tab=mine"
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
  const total = leaveRequests.length + outOfficeRequests.length;
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
              Hàng đợi phê duyệt cần xử lý ({total} đơn)
            </h2>
            <p className="text-xs text-slate-600">
              Có đơn của nhân viên đang chờ bạn xem xét và phê duyệt.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {leaveRequests.length > 0 && (
            <Link
              href="/approvals/leave"
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#005a3c] text-white hover:bg-[#044e3f] shadow-xs transition-colors"
            >
              Duyệt nghỉ phép ({leaveRequests.length})
            </Link>
          )}
          {outOfficeRequests.length > 0 && (
            <Link
              href="/approvals/out-office"
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-white hover:bg-slate-900 shadow-xs transition-colors"
            >
              Duyệt ra ngoài ({outOfficeRequests.length})
            </Link>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 pt-1">
        {leaveRequests.slice(0, 3).map((r) => (
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
        {outOfficeRequests.slice(0, 3).map((r) => (
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
    <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/90 space-y-4">
      <SectionHeading
        title="Hoạt động gần đây của tôi"
        detail="Các đơn nghỉ phép & ra ngoài mới nhất"
        action={
          <div className="flex items-center gap-3 text-xs font-semibold">
            <Link
              href="/leave?tab=mine"
              className="text-slate-600 hover:text-[#005a3c]"
            >
              Xem tất cả đơn nghỉ
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/out-office?tab=mine"
              className="text-slate-600 hover:text-[#005a3c]"
            >
              Xem đơn ra ngoài
            </Link>
          </div>
        }
      />

      {activities.length === 0 ? (
        <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <CalendarCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            Chưa có đơn nào gần đây
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Các đơn bạn tạo sẽ xuất hiện và cập nhật trạng thái tại đây
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {activities.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 hover:bg-slate-50/70 px-2 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    item.type === "LEAVE"
                      ? "bg-emerald-100/70 text-[#005a3c]"
                      : "bg-blue-100/70 text-blue-700"
                  }`}
                >
                  {item.type === "LEAVE" ? (
                    <CalendarDays className="w-4 h-4" />
                  ) : (
                    <Clock className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.dateInfo}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <StatusBadge status={item.status} />
                <Link
                  href={item.link}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-[#005a3c] hover:text-white transition-colors"
                >
                  Chi tiết
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ManagerActivity({ activities }: { activities: ScopeActivityItem[] }) {
  return (
    <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/90 space-y-4">
      <SectionHeading
        title="Hoạt động phòng ban gần đây"
        detail="Đơn từ cán bộ công nhân viên trong phòng ban của bạn"
      />

      {activities.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">
          Chưa có hoạt động mới trong phòng ban.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {activities.slice(0, 5).map((act) => (
            <div
              key={`${act.type}-${act.id}`}
              className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {act.employeeName} · {act.detailLabel}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{act.dateLabel}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={act.status} />
                <Link
                  href={act.link}
                  className="text-xs font-semibold text-[#005a3c] hover:underline"
                >
                  Chi tiết →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string };
}) {
  const user = await requireAuth();
  let reportFrom = validDateFilter(searchParams?.from);
  let reportTo = validDateFilter(searchParams?.to);
  if (reportFrom && reportTo && reportFrom > reportTo) {
    reportFrom = undefined;
    reportTo = undefined;
  }

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

  const [
    stats,
    recentActivities,
    pendingLeaves,
    pendingOutOffices,
    scopeReport,
    advancedReport,
    scopeActivity,
    absenceItems,
  ] = await Promise.all([
    hasPersonalDashboard
      ? getDashboardStats(user)
      : Promise.resolve(emptyStats),
    hasPersonalDashboard
      ? getRecentActivities(user)
      : Promise.resolve([] as RecentActivityItem[]),
    isApprover ? getPendingLeaveRequestsForApprover(user) : Promise.resolve([]),
    isOutOfficeApprover
      ? getPendingOutOfficeRequestsForApprover(user)
      : Promise.resolve([]),
    needsReport
      ? getScopeReport(user, reportFrom, reportTo)
      : Promise.resolve(emptyReport),
    needsReport
      ? getHrAdvancedReport(user, reportFrom, reportTo)
      : Promise.resolve(emptyAdvancedReport),
    isManager
      ? getScopeActivityFeed(user, reportFrom, reportTo)
      : Promise.resolve([] as ScopeActivityItem[]),
    getAbsenceCalendar(user, reportFrom, reportTo),
  ]);

  const totalPending = pendingLeaves.length + pendingOutOffices.length;
  const roleDescription = isAccountant
    ? "Theo dõi dữ liệu toàn công ty · Chế độ chỉ đọc đối soát"
    : isAdmin
      ? "Quản trị tài khoản và hồ sơ nhân sự"
      : isDirector
        ? "Hệ thống phê duyệt & Giám sát vận hành toàn công ty"
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

      {/* Approvals Queue if approver */}
      {(isApprover || isOutOfficeApprover) && (
        <ApprovalQueue
          leaveRequests={pendingLeaves}
          outOfficeRequests={pendingOutOffices}
        />
      )}

      {/* Reports if manager/director/accountant */}
      {needsReport && (
        <ReportSection
          report={scopeReport}
          scopeLabel={scopeLabel}
          reportFrom={reportFrom}
          reportTo={reportTo}
          showDepartmentBreakdown={isAdmin || isDirector || isAccountant}
        />
      )}

      {needsReport && <AdvancedReportSection report={advancedReport} />}

      <AbsenceCalendar items={absenceItems} />

      {/* Personal KPI stats */}
      {hasPersonalDashboard && (
        <PersonalSummary stats={stats} isManager={isManager} />
      )}

      {/* Manager activity */}
      {isManager && <ManagerActivity activities={scopeActivity} />}

      {/* Recent activities */}
      {hasPersonalDashboard && (
        <PersonalActivity activities={recentActivities} />
      )}
    </div>
  );
}
