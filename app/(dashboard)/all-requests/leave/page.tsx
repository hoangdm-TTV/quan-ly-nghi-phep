import { requireAuth } from '@/lib/auth/permissions';
import { getAllLeaveRequests } from '@/lib/leave/queries';
import { redirect } from 'next/navigation';
import LeaveStatusBadge from '@/components/leave/leave-status-badge';
import Link from 'next/link';
import { FileText, ArrowRight, Calendar, Users } from 'lucide-react';

export const metadata = {
  title: 'Tất cả đơn nghỉ phép | Leave & Gate Pass',
};

export default async function AllLeaveRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const user = await requireAuth();
  if (user.role !== 'DIRECTOR' && user.role !== 'ACCOUNTANT') {
    redirect('/');
  }
  const currentFilter = searchParams?.status || 'ALL';
  const requests = await getAllLeaveRequests(currentFilter);
  const isReadOnly = user.role === 'ACCOUNTANT';

  const filters = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Chờ Giám đốc', value: 'APPROVED_BY_LEAD' },
    { label: 'Chờ nộp giấy', value: 'WAITING_FOR_DOC' },
    { label: 'Hoàn tất', value: 'COMPLETED' },
    { label: 'Từ chối', value: 'REJECTED' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Tất cả đơn nghỉ phép
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isReadOnly
            ? 'Xem toàn bộ đơn nghỉ phép trong công ty (chỉ đọc — đối soát chấm công).'
            : 'Xem toàn bộ đơn nghỉ phép trong công ty.'}
        </p>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        {filters.map((f) => {
          const isActive = currentFilter === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === 'ALL' ? '/all-requests/leave' : `/all-requests/leave?status=${f.value}`}
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
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Không có đơn nghỉ phép nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Không có đơn nào phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Nhân viên</th>
                  <th className="px-6 py-3.5">Phòng ban</th>
                  <th className="px-6 py-3.5">Thời gian nghỉ</th>
                  <th className="px-6 py-3.5">Số ngày</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                      {r.employee_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                      {r.department_name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{r.start_date}</span>
                        <span className="text-slate-400">→</span>
                        <span>{r.end_date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{r.duration_days}</span> ngày
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <LeaveStatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/leave/${r.id}`}
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
