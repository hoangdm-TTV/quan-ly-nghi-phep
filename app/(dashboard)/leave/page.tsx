import { requireAuth } from '@/lib/auth/permissions';
import { getVisibleLeaveRequests, getScopedLeaveRequests, ScopedLeaveFilter } from '@/lib/leave/queries';
import { canSubmitPersonalRequests, canApproveWorkflowRequests, canViewRequestScope } from '@/lib/auth/roles';
import { getUserDataScopeLabel } from '@/lib/auth/data-scope';
import { getUsersInScope } from '@/lib/db/queries/users';
import { redirect } from 'next/navigation';
import LeaveStatusBadge from '@/components/leave/leave-status-badge';
import Link from 'next/link';
import { Plus, FileText, ArrowRight, Calendar, Filter } from 'lucide-react';

export const metadata = {
  title: 'Đơn nghỉ phép | Tri Thức Việt',
};

function validDate(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10) === value ? value : undefined;
}

export default async function LeaveListPage({
  searchParams,
}: {
  searchParams: { status?: string; tab?: string; employeeId?: string; from?: string; to?: string };
}) {
  const user = await requireAuth();
  const canSubmit = canSubmitPersonalRequests(user.role);
  const canTrackScope = canViewRequestScope(user.role);
  if (!canSubmit && !canTrackScope) {
    redirect(canApproveWorkflowRequests(user.role) ? '/approvals/leave' : '/');
  }

  const currentFilter = searchParams?.status || 'ALL';
  const scopeLabel = getUserDataScopeLabel(user);
  const hasScope = canTrackScope;
  const activeTab = hasScope
    ? (canSubmit && searchParams?.tab === 'mine' ? 'mine' : 'scope')
    : 'mine';

  const filters = [
    { label: 'Tất cả đơn', value: 'ALL' },
    { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Chờ Giám đốc', value: 'APPROVED_BY_LEAD' },
    { label: 'Chờ nộp giấy', value: 'WAITING_FOR_DOC' },
    { label: 'Đã duyệt / Hoàn tất', value: 'COMPLETED' },
    { label: 'Từ chối', value: 'REJECTED' },
  ];

  let requests;
  let scopedUsers: Awaited<ReturnType<typeof getUsersInScope>> = [];

  if (activeTab === 'scope' && hasScope) {
    const filter: ScopedLeaveFilter = {
      status: currentFilter,
      employeeId: searchParams?.employeeId || undefined,
      fromDate: validDate(searchParams?.from),
      toDate: validDate(searchParams?.to),
    };
    [requests, scopedUsers] = await Promise.all([
      getScopedLeaveRequests(user, filter),
      getUsersInScope(user),
    ]);
  } else {
    requests = await getVisibleLeaveRequests(user, currentFilter);
  }

  const buildTabUrl = (tab: string) => {
    const params = new URLSearchParams();
    if (hasScope) params.set('tab', tab);
    if (currentFilter !== 'ALL') params.set('status', currentFilter);
    const qs = params.toString();
    return qs ? `/leave?${qs}` : '/leave';
  };

  const buildFilterUrl = (status: string) => {
    const params = new URLSearchParams();
    if (hasScope) params.set('tab', activeTab);
    if (status !== 'ALL') params.set('status', status);
    if (searchParams?.employeeId) params.set('employeeId', searchParams.employeeId);
    if (searchParams?.from) params.set('from', searchParams.from);
    if (searchParams?.to) params.set('to', searchParams.to);
    const qs = params.toString();
    return qs ? `/leave?${qs}` : '/leave';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Quản lý Đơn nghỉ phép
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#005a3c] border border-emerald-200">
              {requests.length} đơn
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {activeTab === 'scope'
              ? `Đơn nghỉ phép trong phạm vi: ${scopeLabel}`
              : 'Theo dõi tiến trình và trạng thái các đơn nghỉ phép cá nhân của bạn.'}
          </p>
        </div>

        {canSubmit && activeTab === 'mine' && (
          <Link
            href="/leave/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl shadow-xs text-xs sm:text-sm font-bold text-white bg-[#005a3c] hover:bg-[#044e3f] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo đơn nghỉ phép</span>
          </Link>
        )}
      </div>

      {/* Tabs Switcher: Đơn của tôi / Toàn bộ đơn */}
      {hasScope && (
        <div className="flex items-center gap-2 bg-slate-200/60 p-1.5 rounded-xl w-fit">
          {canSubmit && (
            <Link
              href={buildTabUrl('mine')}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                activeTab === 'mine'
                  ? 'bg-white text-[#005a3c] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đơn của tôi
            </Link>
          )}
          <Link
            href={buildTabUrl('scope')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              activeTab === 'scope'
                ? 'bg-white text-[#005a3c] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {user.role === 'MANAGER' ? 'Đơn phòng ban' : 'Toàn bộ đơn công ty'}
          </Link>
        </div>
      )}

      {/* Scope Filter Bar */}
      {activeTab === 'scope' && (
        <form method="get" className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-end gap-3.5">
          <input type="hidden" name="tab" value="scope" />
          {currentFilter !== 'ALL' && <input type="hidden" name="status" value={currentFilter} />}
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="emp" className="block text-xs font-bold text-slate-700 mb-1.5">
              Nhân viên
            </label>
            <select
              id="emp"
              name="employeeId"
              defaultValue={searchParams?.employeeId || ''}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c]"
            >
              <option value="">Tất cả nhân viên</option>
              {scopedUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from" className="block text-xs font-bold text-slate-700 mb-1.5">Từ ngày</label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={searchParams?.from}
              className="rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c]"
            />
          </div>
          <div>
            <label htmlFor="to" className="block text-xs font-bold text-slate-700 mb-1.5">Đến ngày</label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={searchParams?.to}
              className="rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005a3c]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-xl bg-[#005a3c] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#044e3f] shadow-xs transition-colors"
            >
              Lọc kết quả
            </button>
            {(searchParams?.employeeId || searchParams?.from || searchParams?.to) && (
              <Link
                href={buildFilterUrl(currentFilter)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Xóa lọc
              </Link>
            )}
          </div>
        </form>
      )}

      {/* Filter Status Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {filters.map((f) => {
          const isActive = currentFilter === f.value;
          return (
            <Link
              key={f.value}
              href={buildFilterUrl(f.value)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#005a3c] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Main Request Table Card */}
      {requests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Không có đơn nghỉ phép nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'scope'
              ? 'Không có đơn nào phù hợp với bộ lọc hiện tại trong phạm vi của bạn.'
              : currentFilter === 'ALL'
              ? 'Bạn chưa tạo đơn nghỉ phép nào trong hệ thống.'
              : 'Không có đơn nào phù hợp với bộ lọc hiện tại.'}
          </p>
          {activeTab === 'mine' && canSubmit && currentFilter === 'ALL' && (
            <div className="pt-2">
              <Link
                href="/leave/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-[#005a3c] hover:bg-[#044e3f]"
              >
                <Plus className="w-4 h-4" />
                Tạo đơn đầu tiên
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/90 text-slate-700 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  {activeTab === 'scope' && <th className="px-5 py-3.5">Nhân viên</th>}
                  {activeTab === 'scope' && <th className="px-5 py-3.5">Phòng ban</th>}
                  <th className="px-5 py-3.5">Thời gian nghỉ</th>
                  <th className="px-5 py-3.5">Số ngày</th>
                  <th className="px-5 py-3.5">Lý do</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    {activeTab === 'scope' && (
                      <td className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap">
                        {r.employee_name}
                      </td>
                    )}
                    {activeTab === 'scope' && (
                      <td className="px-5 py-4 text-slate-600 whitespace-nowrap font-medium">
                        {r.department_name || '—'}
                      </td>
                    )}
                    <td className="px-5 py-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#005a3c]" />
                        <span className="font-semibold">{r.start_date}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-semibold">{r.end_date}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900 text-sm">{r.duration_days}</span> ngày
                    </td>
                    <td className="px-5 py-4 max-w-xs truncate text-slate-600 font-medium" title={r.reason || ''}>
                      {r.reason || '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <LeaveStatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/leave/${r.id}`}
                        className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold text-[#005a3c] bg-emerald-50 hover:bg-[#005a3c] hover:text-white transition-all"
                      >
                        Chi tiết
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
