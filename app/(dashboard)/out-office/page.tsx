import { requireAuth } from '@/lib/auth/permissions';
import { getVisibleOutOfficeRequests, getScopedOutOfficeRequests, ScopedOutOfficeFilter } from '@/lib/out-office/queries';
import { canSubmitPersonalRequests, canApproveWorkflowRequests } from '@/lib/auth/roles';
import { getUserDataScopeLabel } from '@/lib/auth/data-scope';
import { getUsersInScope } from '@/lib/db/queries/users';
import { redirect } from 'next/navigation';
import OutOfficeStatusBadge from '@/components/out-office/out-office-status-badge';
import Link from 'next/link';
import { Plus, Clock, ArrowRight, Calendar, Briefcase, UserCheck } from 'lucide-react';

export const metadata = {
  title: 'Đơn xin ra ngoài | Leave & Gate Pass',
};

function validDate(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10) === value ? value : undefined;
}

export default async function OutOfficeListPage({
  searchParams,
}: {
  searchParams: { status?: string; tab?: string; employeeId?: string; from?: string; to?: string };
}) {
  const user = await requireAuth();
  if (!canSubmitPersonalRequests(user.role)) {
    redirect(canApproveWorkflowRequests(user.role) ? '/approvals/out-office' : '/');
  }

  const currentFilter = searchParams?.status || 'ALL';
  const scopeLabel = getUserDataScopeLabel(user);
  const hasScope = scopeLabel !== 'Cá nhân';
  const activeTab = hasScope && searchParams?.tab === 'scope' ? 'scope' : 'mine';

  const filters = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Đang ra ngoài', value: 'APPROVED' },
    { label: 'Đã hoàn tất', value: 'COMPLETED' },
    { label: 'Đã từ chối', value: 'REJECTED' },
  ];

  let requests;
  let scopedUsers: Awaited<ReturnType<typeof getUsersInScope>> = [];

  if (activeTab === 'scope' && hasScope) {
    const filter: ScopedOutOfficeFilter = {
      status: currentFilter,
      employeeId: searchParams?.employeeId || undefined,
      fromDate: validDate(searchParams?.from),
      toDate: validDate(searchParams?.to),
    };
    [requests, scopedUsers] = await Promise.all([
      getScopedOutOfficeRequests(user, filter),
      getUsersInScope(user),
    ]);
  } else {
    requests = await getVisibleOutOfficeRequests(user, currentFilter);
  }

  const buildTabUrl = (tab: string) => {
    const params = new URLSearchParams();
    if (tab === 'scope') params.set('tab', 'scope');
    if (currentFilter !== 'ALL') params.set('status', currentFilter);
    const qs = params.toString();
    return qs ? `/out-office?${qs}` : '/out-office';
  };

  const buildFilterUrl = (status: string) => {
    const params = new URLSearchParams();
    if (activeTab === 'scope') params.set('tab', 'scope');
    if (status !== 'ALL') params.set('status', status);
    if (searchParams?.employeeId) params.set('employeeId', searchParams.employeeId);
    if (searchParams?.from) params.set('from', searchParams.from);
    if (searchParams?.to) params.set('to', searchParams.to);
    const qs = params.toString();
    return qs ? `/out-office?${qs}` : '/out-office';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Đơn xin ra ngoài</h2>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === 'scope'
              ? `Đơn ra ngoài trong phạm vi: ${scopeLabel}`
              : 'Theo dõi trạng thái xin ra ngoài trong giờ làm việc và xác nhận hoàn tất.'}
          </p>
        </div>

        {user.role !== 'DIRECTOR' && (
          <Link
            href="/out-office/new"
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tạo đơn xin ra ngoài
          </Link>
        )}
      </div>

      {hasScope && (
        <div className="flex items-center gap-1.5">
          <Link
            href={buildTabUrl('mine')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'mine'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            Đơn của tôi
          </Link>
          <Link
            href={buildTabUrl('scope')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'scope'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            {scopeLabel}
          </Link>
        </div>
      )}

      {activeTab === 'scope' && (
        <form method="get" className="flex flex-col sm:flex-row sm:items-end gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200">
          <input type="hidden" name="tab" value="scope" />
          {currentFilter !== 'ALL' && <input type="hidden" name="status" value={currentFilter} />}
          <div>
            <label htmlFor="emp" className="block text-[11px] font-medium text-slate-600 mb-1">Nhân viên</label>
            <select id="emp" name="employeeId" defaultValue={searchParams?.employeeId || ''} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs min-w-[180px]">
              <option value="">Tất cả nhân viên</option>
              {scopedUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from" className="block text-[11px] font-medium text-slate-600 mb-1">Từ ngày</label>
            <input id="from" name="from" type="date" defaultValue={searchParams?.from} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
          </div>
          <div>
            <label htmlFor="to" className="block text-[11px] font-medium text-slate-600 mb-1">Đến ngày</label>
            <input id="to" name="to" type="date" defaultValue={searchParams?.to} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" />
          </div>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">Lọc</button>
          {(searchParams?.employeeId || searchParams?.from || searchParams?.to) && (
            <Link href={buildFilterUrl(currentFilter)} className="px-2 py-2 text-xs font-medium text-slate-600 hover:text-slate-900">Xóa lọc</Link>
          )}
        </form>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        {filters.map((f) => {
          const isActive = currentFilter === f.value;
          return (
            <Link
              key={f.value}
              href={buildFilterUrl(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Không có đơn xin ra ngoài nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'scope'
              ? 'Không có đơn nào phù hợp với bộ lọc hiện tại trong phạm vi của bạn.'
              : currentFilter === 'ALL'
              ? 'Bạn chưa tạo đơn xin ra ngoài nào trong hệ thống.'
              : 'Không có đơn nào phù hợp với bộ lọc hiện tại.'}
          </p>
          {activeTab === 'mine' && user.role !== 'DIRECTOR' && currentFilter === 'ALL' && (
            <div className="pt-2">
              <Link
                href="/out-office/new"
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Tạo đơn đầu tiên
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  {activeTab === 'scope' && <th className="px-6 py-3.5">Nhân viên</th>}
                  {activeTab === 'scope' && <th className="px-6 py-3.5">Phòng ban</th>}
                  <th className="px-6 py-3.5">Ngày ra ngoài</th>
                  <th className="px-6 py-3.5">Khung giờ</th>
                  <th className="px-6 py-3.5">Số giờ</th>
                  <th className="px-6 py-3.5">Mục đích</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    {activeTab === 'scope' && (
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                        {r.employee_name}
                      </td>
                    )}
                    {activeTab === 'scope' && (
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {r.department_name || '—'}
                      </td>
                    )}
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{r.request_date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">
                      {r.start_time} → {r.end_time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-blue-700">{r.estimated_hours}</span> giờ
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {r.reason_type === 'WORK' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Briefcase className="w-3 h-3" /> Việc công
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                          <UserCheck className="w-3 h-3" /> Việc riêng
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <OutOfficeStatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/out-office/${r.id}`}
                        className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Xem
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
