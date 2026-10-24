import { requireAuth } from '@/lib/auth/permissions';
import {
  getDashboardStats,
  getRecentActivities,
  getScopeReport,
  getScopeActivityFeed,
  type DashboardStats,
  type ScopeReport,
  type ScopeActivityItem,
  type RecentActivityItem,
} from '@/lib/dashboard/queries';
import { getUserDataScopeLabel } from '@/lib/auth/data-scope';
import { getRoleLabel } from '@/lib/auth/role-labels';
import { getPendingLeaveRequestsForApprover } from '@/lib/leave/queries';
import { getPendingOutOfficeRequestsForApprover } from '@/lib/out-office/queries';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Inbox,
  Sparkles,
  FileText,
  UserCheck,
  CalendarRange,
  BarChart3,
} from 'lucide-react';

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
    leaveDays: 0,
    outOfficeTotal: 0,
    outOfficePending: 0,
    outOfficeApproved: 0,
    outOfficeCompleted: 0,
    outOfficeRejected: 0,
    outOfficeHours: 0,
  },
};

function StatusPill({ status }: { status: string }) {
  const className = status === 'COMPLETED' || status === 'WAITING_FOR_DOC'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'REJECTED'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';
  const label = status === 'WAITING_FOR_DOC' ? 'Chờ nộp giấy' : status;

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
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
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            {showDepartmentBreakdown ? 'Báo cáo trong phạm vi quản lý' : 'Báo cáo tổng hợp toàn công ty'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {scopeLabel} · Lọc theo ngày bắt đầu nghỉ hoặc ngày xin ra ngoài.
          </p>
        </div>
        <span className="text-[11px] text-slate-500">Chỉ hiển thị số liệu tổng hợp</span>
      </div>

      <form action="/" method="get" className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="report-from" className="mb-1 block text-[11px] font-medium text-slate-600">Từ ngày</label>
          <input id="report-from" name="from" type="date" defaultValue={reportFrom} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
        </div>
        <div>
          <label htmlFor="report-to" className="mb-1 block text-[11px] font-medium text-slate-600">Đến ngày</label>
          <input id="report-to" name="to" type="date" defaultValue={reportTo} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">Lọc báo cáo</button>
        {(reportFrom || reportTo) && <Link href="/" className="px-2 py-2 text-xs font-medium text-slate-600 hover:text-slate-900">Xóa bộ lọc</Link>}
      </form>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Đơn nghỉ phép" value={report.totals.leaveTotal} sub={`${report.totals.leavePending} chờ · ${report.totals.leaveRejected} từ chối`} color="blue" />
        <MetricCard label="Ngày nghỉ đã duyệt" value={Number(report.totals.leaveDays.toFixed(1))} sub="Đã duyệt, chờ nộp giấy hoặc hoàn tất" color="indigo" />
        <MetricCard label="Đơn ra ngoài" value={report.totals.outOfficeTotal} sub={`${report.totals.outOfficePending} chờ · ${report.totals.outOfficeRejected} từ chối`} color="teal" />
        <MetricCard label="Giờ ra ngoài đã duyệt" value={`${Number(report.totals.outOfficeHours.toFixed(2))} giờ`} sub="Tổng giờ dự kiến đã duyệt/hoàn tất" color="amber" />
      </div>

      {showDepartmentBreakdown && (
        report.departments.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Phòng ban</th>
                  <th className="px-4 py-3">Đơn nghỉ</th>
                  <th className="px-4 py-3">Ngày đã duyệt</th>
                  <th className="px-4 py-3">Đơn ra ngoài</th>
                  <th className="px-4 py-3">Giờ đã duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.departments.map((department) => (
                  <tr key={department.departmentName}>
                    <td className="px-4 py-3 font-medium text-slate-900">{department.departmentName}</td>
                    <td className="px-4 py-3 text-slate-700">{department.leaveTotal} <span className="text-slate-400">({department.leavePending} chờ)</span></td>
                    <td className="px-4 py-3 text-slate-700">{Number(department.leaveDays.toFixed(1))}</td>
                    <td className="px-4 py-3 text-slate-700">{department.outOfficeTotal} <span className="text-slate-400">({department.outOfficePending} chờ)</span></td>
                    <td className="px-4 py-3 text-slate-700">{Number(department.outOfficeHours.toFixed(2))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">Chưa có dữ liệu báo cáo trong phạm vi này.</p>
        )
      )}
    </section>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: 'blue' | 'indigo' | 'teal' | 'amber' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 text-blue-900',
    indigo: 'bg-indigo-50 text-indigo-700 text-indigo-900',
    teal: 'bg-teal-50 text-teal-700 text-teal-900',
    amber: 'bg-amber-50 text-amber-700 text-amber-900',
  };
  const [background, labelColor, valueColor] = colors[color].split(' ');
  return (
    <div className={`rounded-xl p-4 ${background}`}>
      <p className={`text-[11px] ${labelColor}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueColor}`}>{value}</p>
      <p className={`mt-1 text-[10px] ${labelColor}`}>{sub}</p>
    </div>
  );
}

function PersonalActivity({ activities }: { activities: RecentActivityItem[] }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileText className="h-4 w-4 text-blue-600" />Đơn gần đây của bạn</h3>
        <div className="flex gap-3 text-xs">
          <Link href="/leave" className="font-medium text-blue-600 hover:text-blue-800">Nghỉ phép</Link>
          <Link href="/out-office" className="font-medium text-blue-600 hover:text-blue-800">Ra ngoài</Link>
        </div>
      </div>
      {activities.length === 0 ? (
        <div className="space-y-2 py-6 text-center text-slate-500">
          <Inbox className="mx-auto h-8 w-8 text-slate-300" />
          <p className="text-xs font-medium">Bạn chưa có đơn nào gần đây.</p>
          <p className="text-[11px]">Các đơn bạn tạo sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {activities.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex flex-col gap-2 px-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-[11px] text-slate-500">{item.dateInfo}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={item.status} />
                <Link href={item.link} className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800">Chi tiết <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
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
    <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarRange className="h-4 w-4 text-blue-600" />Hoạt động trong phòng ban</h3>
        <p className="mt-1 text-xs text-slate-500">Danh sách chi tiết được giới hạn theo phạm vi dữ liệu của Trưởng phòng.</p>
      </div>
      {activities.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">Chưa có hoạt động trong khoảng thời gian này.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-600"><tr><th className="px-4 py-3">Ngày</th><th className="px-4 py-3">Nhân viên</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3">Chi tiết</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Xem</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {activities.map((item) => (
                <tr key={`${item.type}-${item.id}`}>
                  <td className="whitespace-nowrap px-4 py-3">{item.dateLabel}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{item.employeeName}<span className="block text-[10px] font-normal text-slate-400">{item.departmentName || 'Chưa phân bổ'}</span></td>
                  <td className="whitespace-nowrap px-4 py-3">{item.type === 'LEAVE' ? 'Nghỉ phép' : 'Ra ngoài'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.detailLabel}</td>
                  <td className="px-4 py-3"><StatusPill status={item.status} /></td>
                  <td className="px-4 py-3"><Link href={item.link} className="font-medium text-blue-600 hover:text-blue-800">Chi tiết</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ApprovalQueue({ leaveCount, outOfficeCount, leaveRequests, outOfficeRequests }: {
  leaveCount: number;
  outOfficeCount: number;
  leaveRequests: Awaited<ReturnType<typeof getPendingLeaveRequestsForApprover>>;
  outOfficeRequests: Awaited<ReturnType<typeof getPendingOutOfficeRequestsForApprover>>;
}) {
  const total = leaveCount + outOfficeCount;
  return (
    <section className="space-y-4 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3 border-b border-amber-100 pb-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><UserCheck className="h-4 w-4 text-amber-600" />Hàng đợi cần bạn xử lý</h3>
          <p className="mt-1 text-xs text-slate-500">Các đơn chỉ được đưa vào hàng đợi khi đến đúng lượt duyệt của bạn.</p>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{total}</span>
      </div>
      {total === 0 ? (
        <p className="py-3 text-center text-xs text-slate-500">Hiện không có đơn nào chờ bạn duyệt.</p>
      ) : (
        <div className="space-y-3">
          {leaveCount > 0 && <Link href="/approvals/leave" className="flex items-center justify-between rounded-xl bg-blue-50 p-4 text-xs font-semibold text-blue-900 hover:bg-blue-100"><span>{leaveCount} đơn nghỉ phép</span><span className="inline-flex items-center">Mở hàng đợi <ArrowRight className="ml-1 h-3.5 w-3.5" /></span></Link>}
          {outOfficeCount > 0 && <Link href="/approvals/out-office" className="flex items-center justify-between rounded-xl bg-teal-50 p-4 text-xs font-semibold text-teal-900 hover:bg-teal-100"><span>{outOfficeCount} đơn ra ngoài</span><span className="inline-flex items-center">Mở hàng đợi <ArrowRight className="ml-1 h-3.5 w-3.5" /></span></Link>}
          <div className="grid gap-2 sm:grid-cols-2">
            {leaveRequests.slice(0, 3).map((request) => <Link key={request.id} href={`/leave/${request.id}`} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><p className="text-xs font-semibold text-slate-900">{request.employee_name} · Nghỉ phép</p><p className="mt-1 text-[11px] text-slate-500">{request.start_date} → {request.end_date} ({request.duration_days} ngày)</p></Link>)}
            {outOfficeRequests.slice(0, 3).map((request) => <Link key={request.id} href={`/out-office/${request.id}`} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50"><p className="text-xs font-semibold text-slate-900">{request.employee_name} · Ra ngoài</p><p className="mt-1 text-[11px] text-slate-500">{request.request_date} · {request.start_time}–{request.end_time}</p></Link>)}
          </div>
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

  const isAccountant = user.role === 'ACCOUNTANT';
  const isDirector = user.role === 'DIRECTOR';
  const isManager = user.role === 'MANAGER';
  const isApprover = isManager || isDirector;
  const canSubmit = user.role === 'STAFF' || user.role === 'TEAM_LEAD' || isManager;
  const hasPersonalDashboard = canSubmit;
  const needsReport = isManager || isDirector || isAccountant;
  const scopeLabel = getUserDataScopeLabel(user);

  const [stats, recentActivities, pendingLeaves, pendingOutOffices, scopeReport, scopeActivity] = await Promise.all([
    hasPersonalDashboard ? getDashboardStats(user) : Promise.resolve(emptyStats),
    hasPersonalDashboard ? getRecentActivities(user) : Promise.resolve([] as RecentActivityItem[]),
    isApprover ? getPendingLeaveRequestsForApprover(user) : Promise.resolve([]),
    isApprover ? getPendingOutOfficeRequestsForApprover(user) : Promise.resolve([]),
    needsReport ? getScopeReport(user, reportFrom, reportTo) : Promise.resolve(emptyReport),
    isManager ? getScopeActivityFeed(user, reportFrom, reportTo) : Promise.resolve([] as ScopeActivityItem[]),
  ]);
  const pendingLeaveCount = pendingLeaves.length;
  const pendingOutOfficeCount = pendingOutOffices.length;
  const totalPending = pendingLeaveCount + pendingOutOfficeCount;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-5 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-800 to-blue-900 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-100"><Sparkles className="h-3.5 w-3.5" />Tổng quan công việc</div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Xin chào, {user.full_name}!</h2>
          <p className="max-w-2xl text-xs text-blue-100/90 sm:text-sm">
            {getRoleLabel(user.role)}{user.department_name ? ` · ${user.department_name}` : ''}{user.team_name ? ` · ${user.team_name}` : ''}
            {isAccountant ? ' · Quyền xem báo cáo tổng hợp' : isDirector ? ' · Phạm vi toàn công ty' : isManager ? ' · Phạm vi phòng ban và hàng đợi duyệt' : ' · Theo dõi các đơn của bạn'}
          </p>
        </div>
        {canSubmit && (
          <div className="flex flex-wrap gap-2.5">
            <Link href="/leave/new" className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-blue-900 shadow-sm hover:bg-blue-50"><Plus className="mr-1.5 h-4 w-4" />Tạo đơn nghỉ phép</Link>
            <Link href="/out-office/new" className="inline-flex items-center rounded-xl border border-white/20 bg-blue-600/60 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-600"><Clock className="mr-1.5 h-4 w-4" />Tạo đơn ra ngoài</Link>
          </div>
        )}
      </header>

      {isAccountant && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Tài khoản Kế toán chỉ xem báo cáo tổng hợp. Không hiển thị đơn cá nhân, thông tin nhân viên theo từng dòng hoặc thao tác duyệt.
        </div>
      )}

      {isApprover && <ApprovalQueue leaveCount={pendingLeaveCount} outOfficeCount={pendingOutOfficeCount} leaveRequests={pendingLeaves} outOfficeRequests={pendingOutOffices} />}

      {hasPersonalDashboard && (
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tình hình đơn cá nhân</h3>
            <p className="mt-1 text-xs text-slate-500">Chỉ thống kê các đơn do bạn tạo.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <PersonalMetric icon={<CalendarDays className="h-4 w-4" />} label="Đơn nghỉ phép" total={stats.myLeaveTotal} pending={stats.myLeavePending} done={stats.myLeaveApproved} doneLabel="đã duyệt/hoàn tất" tone="blue" />
            <PersonalMetric icon={<Clock className="h-4 w-4" />} label="Đơn ra ngoài" total={stats.myOutOfficeTotal} pending={stats.myOutOfficePending} done={stats.myOutOfficeCompleted} doneLabel="hoàn tất" tone="teal" />
            {isManager ? (
              <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:col-span-2">
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Đến lượt bạn duyệt</span><UserCheck className="h-4 w-4 text-amber-600" /></div>
                <p className="mt-2 text-2xl font-bold text-slate-900">{totalPending}</p>
                <p className="mt-1 text-[11px] text-slate-500">{pendingLeaveCount} nghỉ phép · {pendingOutOfficeCount} ra ngoài</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Phạm vi dữ liệu</span><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
                <p className="mt-2 text-sm font-bold text-slate-900">{scopeLabel}</p>
                <p className="mt-1 text-[11px] text-slate-500">Bạn chỉ xem đơn trong phạm vi được cấp.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {needsReport && <ReportSection report={scopeReport} scopeLabel={scopeLabel} reportFrom={reportFrom} reportTo={reportTo} showDepartmentBreakdown={isDirector || isAccountant} />}

      {isManager && <ManagerActivity activities={scopeActivity} />}
      {hasPersonalDashboard && <PersonalActivity activities={recentActivities} />}

      {isDirector && (
        <section className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-xs text-teal-900">
          <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>Dashboard Giám đốc tập trung vào báo cáo toàn công ty và các đơn đến lượt duyệt; không hiển thị thống kê hay đơn cá nhân.</p></div>
        </section>
      )}
    </div>
  );
}

function PersonalMetric({ icon, label, total, pending, done, doneLabel, tone }: {
  icon: React.ReactNode;
  label: string;
  total: number;
  pending: number;
  done: number;
  doneLabel: string;
  tone: 'blue' | 'teal';
}) {
  const iconStyle = tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600';
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{label}</span><span className={`rounded-lg p-2 ${iconStyle}`}>{icon}</span></div>
      <div><span className="text-2xl font-bold text-slate-900">{total}</span><span className="ml-1.5 text-xs text-slate-500">tổng số đơn</span></div>
      <div className="flex flex-wrap gap-x-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500"><span className="font-medium text-amber-600">{pending} đang chờ</span><span>·</span><span className="font-medium text-emerald-600">{done} {doneLabel}</span></div>
    </div>
  );
}
