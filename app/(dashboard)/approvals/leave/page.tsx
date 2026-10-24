import { requireAuth } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { getPendingLeaveRequestsForApprover } from '@/lib/leave/queries';
import LeaveStatusBadge from '@/components/leave/leave-status-badge';
import ApprovalActions from '@/components/leave/approval-actions';
import Link from 'next/link';
import { CheckSquare, Calendar, User, Clock, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Hàng đợi duyệt đơn nghỉ phép | Leave & Gate Pass',
};

export default async function ApprovalsLeavePage() {
  const user = await requireAuth();

  if (user.role !== 'MANAGER' && user.role !== 'DIRECTOR') {
    redirect(user.role === 'ACCOUNTANT' ? '/' : '/leave');
  }

  const pendingRequests = await getPendingLeaveRequestsForApprover(user);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Hàng đợi duyệt đơn nghỉ phép</h2>
        <p className="text-xs text-slate-500 mt-1">
          Danh sách các đơn nghỉ phép thuộc thẩm quyền đang chờ bạn tiếp nhận phê duyệt hoặc từ chối.
        </p>
      </div>

      {pendingRequests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Không có đơn nào chờ xử lý</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Tuyệt vời! Bạn đã hoàn thành tất cả các yêu cầu phê duyệt đơn nghỉ phép thuộc thẩm quyền của mình.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    {req.employee_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{req.employee_name}</h3>
                    <p className="text-[11px] text-slate-500">
                      {req.employee_role} • {req.department_name || 'Chưa phân bổ'}{' '}
                      {req.team_name ? `• ${req.team_name}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <LeaveStatusBadge status={req.status} />
                  <Link
                    href={`/leave/${req.id}`}
                    className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-blue-600 p-1"
                    title="Xem chi tiết"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Thông tin thời gian và lý do */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg">
                <div>
                  <span className="text-slate-500 block">Thời gian nghỉ:</span>
                  <span className="font-semibold text-slate-900">
                    {req.start_date} → {req.end_date}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Số ngày làm việc:</span>
                  <span className="font-bold text-blue-700">
                    {req.duration_days} ngày
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cấp duyệt hiện tại:</span>
                  <span className="font-medium text-purple-700">
                    {req.status === 'PENDING'
                      ? 'Duyệt Cấp 1 (Lead/Manager)'
                      : 'Duyệt Cấp 2 (Giám đốc)'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-700">
                <span className="font-medium text-slate-900">Lý do: </span>
                {req.reason || '—'}
              </div>

              {/* Khu vực thao tác Duyệt / Từ chối */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Gửi lúc {new Date(req.created_at).toLocaleString('vi-VN')}
                </span>
                <ApprovalActions requestId={req.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
