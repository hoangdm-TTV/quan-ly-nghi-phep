import { requireAuth } from '@/lib/auth/permissions';
import { getVisibleLeaveRequests } from '@/lib/leave/queries';
import { canSubmitPersonalRequests, canApproveWorkflowRequests } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import LeaveStatusBadge from '@/components/leave/leave-status-badge';
import Link from 'next/link';
import { Plus, FileText, ArrowRight, Calendar, Clock } from 'lucide-react';

export const metadata = {
  title: 'Danh sách đơn nghỉ phép | Leave & Gate Pass',
};

export default async function LeaveListPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const user = await requireAuth();
  if (!canSubmitPersonalRequests(user.role)) {
    redirect(canApproveWorkflowRequests(user.role) ? '/approvals/leave' : '/');
  }
  const currentFilter = searchParams?.status || 'ALL';
  const requests = await getVisibleLeaveRequests(user, currentFilter);

  const filters = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Chờ duyệt', value: 'PENDING' },
    { label: 'Chờ Giám đốc', value: 'APPROVED_BY_LEAD' },
    { label: 'Chờ nộp giấy', value: 'WAITING_FOR_DOC' },
    { label: 'Từ chối', value: 'REJECTED' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Nút tạo đơn */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Đơn nghỉ phép của tôi</h2>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi trạng thái và tiến trình phê duyệt các đơn xin nghỉ phép của bạn.
          </p>
        </div>

        {user.role !== 'DIRECTOR' && (
          <Link
            href="/leave/new"
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tạo đơn nghỉ phép mới
          </Link>
        )}
      </div>

      {/* Bộ lọc trạng thái */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        {filters.map((f) => {
          const isActive = currentFilter === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === 'ALL' ? '/leave' : `/leave?status=${f.value}`}
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

      {/* Danh sách bảng đơn */}
      {requests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Không có đơn nghỉ phép nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {currentFilter === 'ALL'
              ? 'Bạn chưa tạo đơn nghỉ phép nào trong hệ thống.'
              : 'Không có đơn nào phù hợp với bộ lọc hiện tại.'}
          </p>
          {user.role !== 'DIRECTOR' && currentFilter === 'ALL' && (
            <div className="pt-2">
              <Link
                href="/leave/new"
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
                  <th className="px-6 py-3.5">Thời gian nghỉ</th>
                  <th className="px-6 py-3.5">Số ngày</th>
                  <th className="px-6 py-3.5">Lý do</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5">Ngày tạo</th>
                  <th className="px-6 py-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{r.start_date}</span>
                        <span className="text-slate-400">→</span>
                        <span>{r.end_date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{r.duration_days}</span> ngày làm việc
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-slate-600" title={r.reason || ''}>
                      {r.reason || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <LeaveStatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('vi-VN')}
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
