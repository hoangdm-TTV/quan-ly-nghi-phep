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
import { ArrowRight, Clock, FileText, Plus, UserCheck } from 'lucide-react';

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

const statusLabels: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED_BY_LEAD: 'Chờ Giám đốc',
  WAITING_FOR_DOC: 'Chờ nộp giấy',
  APPROVED: 'Đã duyệt',
  COMPLETED: 'Hoàn tất',
  REJECTED: 'Từ chối',
};

function StatusLabel({ status }: { status: string }) {
  const tone = status === 'COMPLETED' || status === 'WAITING_FOR_DOC' || status === 'APPROVED'
    ? 'text-emerald-700'
    : status === 'REJECTED'
      ? 'text-rose-700'
      : 'text-amber-700';
  return <span className={`text-xs font-medium ${tone}`}>{statusLabels[status] || status}</span>;
}

function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
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
    <section className="space-y-5 border-y border-slate-200 py-5">
      <SectionHeading
        title={showDepartmentBreakdown ? 'Báo cáo toàn công ty' : 'Báo cáo phòng ban'}
        detail={`${scopeLabel} · Số liệu theo ngày bắt đầu nghỉ hoặc ngày xin ra ngoài.`}
      />

      <form action="/" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="report-from" className="text-xs text-slate-600">Từ ngày</label>
          <input id="report-from" name="from" type="date" defaultValue={reportFrom} className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="report-to" className="text-xs text-slate-600">Đến ngày</label>
          <input id="report-to" name="to" type="date" defaultValue={reportTo} className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="h-9 rounded-md bg-slate-900 px-3.5 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">Lọc</button>
          {(reportFrom || reportTo) && <Link href="/" className="inline-flex h-9 items-center px-2 text-sm text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">Xóa lọc</Link>}
        </div>
      </form>

      <dl className="grid grid-cols-2 border-y border-slate-200 sm:grid-cols-4">
        <ReportMetric label="Đơn nghỉ phép" value={totals.leaveTotal} detail={`${totals.leavePending} đang chờ`} />
        <ReportMetric label="Ngày nghỉ đã duyệt" value={Number(totals.leaveDays.toFixed(1))} detail="Ngày" />
        <ReportMetric label="Đơn ra ngoài" value={totals.outOfficeTotal} detail={`${totals.outOfficePending} đang chờ`} />
        <ReportMetric label="Giờ ra ngoài đã duyệt" value={Number(totals.outOfficeHours.toFixed(2))} detail="Giờ dự kiến" />
      </dl>

      {showDepartmentBreakdown && (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">Theo phòng ban</h3>
            <span className="text-xs text-slate-500">{report.departments.length} phòng ban</span>
          </div>
          {report.departments.length === 0 ? (
            <p className="border-y border-slate-200 py-5 text-sm text-slate-500">Chưa có dữ liệu trong phạm vi ngày đã chọn.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-xs font-medium text-slate-500">
                    <th scope="col" className="py-2.5 pr-4">Phòng ban</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Đơn nghỉ</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Ngày đã duyệt</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Đơn ra ngoài</th>
                    <th scope="col" className="py-2.5 pl-3 text-right">Giờ đã duyệt</th>
                  </tr>
                </thead>
                <tbody>
                  {report.departments.map((department) => (
                    <tr key={department.departmentName} className="border-b border-slate-100 last:border-b-0">
                      <th scope="row" className="py-3 pr-4 font-medium text-slate-800">{department.departmentName}</th>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">{department.leaveTotal}<span className="ml-1.5 text-xs text-slate-400">({department.leavePending} chờ)</span></td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">{Number(department.leaveDays.toFixed(1))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">{department.outOfficeTotal}<span className="ml-1.5 text-xs text-slate-400">({department.outOfficePending} chờ)</span></td>
                      <td className="py-3 pl-3 text-right tabular-nums text-slate-700">{Number(department.outOfficeHours.toFixed(2))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ReportMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="min-w-0 border-b border-slate-100 px-3 py-4 first:pl-0 sm:border-b-0 sm:border-r sm:py-4 sm:first:pl-0 sm:last:border-r-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</dd>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function PersonalSummary({ stats, isManager }: { stats: DashboardStats; isManager: boolean }) {
  return (
    <section className="space-y-3">
      <SectionHeading title="Đơn của tôi" detail="Chỉ gồm các đơn do bạn tạo." action={<Link href="/leave?tab=mine" className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline">Xem đơn của tôi</Link>} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PersonalMetric label="Nghỉ phép" total={stats.myLeaveTotal} pending={stats.myLeavePending} done={stats.myLeaveApproved} doneLabel="đã duyệt / hoàn tất" href="/leave?tab=mine" />
        <PersonalMetric label="Ra ngoài" total={stats.myOutOfficeTotal} pending={stats.myOutOfficePending} done={stats.myOutOfficeCompleted} doneLabel="hoàn tất" href="/out-office?tab=mine" />
      </div>
      {isManager && <p className="text-xs text-slate-500">Đơn cá nhân tách biệt với hàng đợi duyệt và báo cáo phòng ban.</p>}
    </section>
  );
}

function PersonalMetric({ label, total, pending, done, doneLabel, href }: {
  label: string;
  total: number;
  pending: number;
  done: number;
  doneLabel: string;
  href: string;
}) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-4 border-b border-slate-200 py-4 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="mt-1 text-xs text-slate-500"><span className="text-amber-700">{pending} chờ</span><span className="mx-1.5 text-slate-300">/</span><span className="text-emerald-700">{done} {doneLabel}</span></p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-semibold tabular-nums text-slate-900">{total}</span>
        <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function PersonalActivity({ activities }: { activities: RecentActivityItem[] }) {
  return (
    <section className="space-y-3">
      <SectionHeading
        title="Hoạt động gần đây"
        detail="Các đơn cá nhân mới cập nhật."
        action={<div className="flex gap-4 text-sm"><Link href="/leave?tab=mine" className="text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">Nghỉ phép</Link><Link href="/out-office?tab=mine" className="text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">Ra ngoài</Link></div>}
      />
      {activities.length === 0 ? (
        <div className="border-b border-slate-200 py-6">
          <p className="text-sm font-medium text-slate-700">Chưa có đơn gần đây.</p>
          <p className="mt-1 text-sm text-slate-500">Đơn bạn tạo sẽ xuất hiện ở đây.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {activities.map((item) => (
            <li key={`${item.type}-${item.id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.dateInfo}</p>
              </div>
              <div className="flex items-center gap-4">
                <StatusLabel status={item.status} />
                <Link href={item.link} className="text-sm text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline">Chi tiết</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ManagerActivity({ activities }: { activities: ScopeActivityItem[] }) {
  return (
    <section className="space-y-3">
      <SectionHeading title="Hoạt động phòng ban" detail="Đơn trong phạm vi phòng ban của bạn." />
      {activities.length === 0 ? (
        <p className="border-b border-slate-200 py-5 text-sm text-slate-500">Chưa có hoạt động trong khoảng thời gian này.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-xs font-medium text-slate-500">
                <th scope="col" className="py-2.5 pr-4">Ngày</th>
                <th scope="col" className="px-3 py-2.5">Nhân viên</th>
                <th scope="col" className="px-3 py-2.5">Loại đơn</th>
                <th scope="col" className="px-3 py-2.5">Chi tiết</th>
                <th scope="col" className="px-3 py-2.5">Trạng thái</th>
                <th scope="col" className="py-2.5 pl-3 text-right">Mở</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((item) => (
                <tr key={`${item.type}-${item.id}`} className="border-b border-slate-100 last:border-b-0">
                  <td className="whitespace-nowrap py-3 pr-4 text-slate-600">{item.dateLabel}</td>
                  <td className="px-3 py-3 font-medium text-slate-800">{item.employeeName}<span className="mt-0.5 block text-xs font-normal text-slate-500">{item.departmentName || 'Chưa phân bổ'}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{item.type === 'LEAVE' ? 'Nghỉ phép' : 'Ra ngoài'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{item.detailLabel}</td>
                  <td className="px-3 py-3"><StatusLabel status={item.status} /></td>
                  <td className="py-3 pl-3 text-right"><Link href={item.link} className="text-sm text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline">Chi tiết</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ApprovalQueue({ leaveRequests, outOfficeRequests }: {
  leaveRequests: Awaited<ReturnType<typeof getPendingLeaveRequestsForApprover>>;
  outOfficeRequests: Awaited<ReturnType<typeof getPendingOutOfficeRequestsForApprover>>;
}) {
  const total = leaveRequests.length + outOfficeRequests.length;
  return (
    <section className="space-y-3">
      <SectionHeading
        title="Cần xử lý"
        detail="Chỉ gồm đơn đến đúng lượt duyệt của bạn."
        action={<span className="text-2xl font-semibold tabular-nums text-slate-900">{total}</span>}
      />
      {total === 0 ? (
        <p className="border-b border-slate-200 py-5 text-sm text-slate-500">Không có đơn nào đang chờ bạn xử lý.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {leaveRequests.slice(0, 4).map((request) => (
            <Link key={request.id} href={`/leave/${request.id}`} className="group flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{request.employee_name}<span className="mx-2 text-slate-300">/</span>Nghỉ phép</p>
                <p className="mt-1 text-xs text-slate-500">{request.start_date} – {request.end_date} · {request.duration_days} ngày</p>
              </div>
              <span className="inline-flex items-center text-sm text-slate-600 group-hover:text-slate-950">Mở đơn <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
          {outOfficeRequests.slice(0, 4).map((request) => (
            <Link key={request.id} href={`/out-office/${request.id}`} className="group flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{request.employee_name}<span className="mx-2 text-slate-300">/</span>Ra ngoài</p>
                <p className="mt-1 text-xs text-slate-500">{request.request_date} · {request.start_time}–{request.end_time}</p>
              </div>
              <span className="inline-flex items-center text-sm text-slate-600 group-hover:text-slate-950">Mở đơn <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm">
        <Link href="/approvals/leave" className="font-medium text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline">Hàng đợi nghỉ phép ({leaveRequests.length})</Link>
        <Link href="/approvals/out-office" className="font-medium text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline">Hàng đợi ra ngoài ({outOfficeRequests.length})</Link>
      </div>
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
  const totalPending = pendingLeaves.length + pendingOutOffices.length;
  const organization = user.department_name || user.team_name || 'Phạm vi cá nhân';
  const roleDescription = isAccountant
    ? 'Theo dõi dữ liệu toàn công ty · Chỉ đọc'
    : isDirector
      ? 'Theo dõi và phê duyệt · Toàn công ty'
      : isManager
        ? `Đơn cá nhân và hoạt động · ${organization}`
        : 'Đơn nghỉ phép và ra ngoài của bạn';

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{getRoleLabel(user.role)}{user.department_name ? ` · ${user.department_name}` : ''}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Tổng quan</h1>
          <p className="mt-1.5 text-sm text-slate-600">{roleDescription}</p>
        </div>
        {canSubmit && (
          <div className="flex flex-wrap gap-2">
            <Link href="/leave/new" className="inline-flex h-9 items-center rounded-md bg-slate-900 px-3.5 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"><Plus className="mr-1.5 h-4 w-4" />Nghỉ phép</Link>
            <Link href="/out-office/new" className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"><Clock className="mr-1.5 h-4 w-4" />Ra ngoài</Link>
          </div>
        )}
      </header>

      {isAccountant && (
        <p className="border-l-2 border-slate-400 pl-3 text-sm text-slate-600">
          Báo cáo bên dưới là số liệu tổng hợp. Để xem từng đơn, mở mục <Link href="/leave?tab=scope" className="font-medium text-slate-800 underline underline-offset-4">Nghỉ phép</Link> hoặc <Link href="/out-office?tab=scope" className="font-medium text-slate-800 underline underline-offset-4">Ra ngoài</Link>; dữ liệu chi tiết ở chế độ chỉ đọc.
        </p>
      )}

      {isApprover && <ApprovalQueue leaveRequests={pendingLeaves} outOfficeRequests={pendingOutOffices} />}
      {needsReport && <ReportSection report={scopeReport} scopeLabel={scopeLabel} reportFrom={reportFrom} reportTo={reportTo} showDepartmentBreakdown={isDirector || isAccountant} />}
      {hasPersonalDashboard && <PersonalSummary stats={stats} isManager={isManager} />}
      {isManager && <ManagerActivity activities={scopeActivity} />}
      {hasPersonalDashboard && <PersonalActivity activities={recentActivities} />}

      {(isDirector || isAccountant) && totalPending === 0 && isDirector && (
        <p className="flex items-center gap-2 text-sm text-slate-500"><UserCheck className="h-4 w-4" />Không có đơn nào đang chờ bạn xử lý.</p>
      )}
      {(isDirector || isAccountant) && <div className="flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500"><FileText className="h-4 w-4" />Phạm vi báo cáo: {scopeLabel}</div>}
    </div>
  );
}
