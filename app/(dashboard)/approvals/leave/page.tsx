import { requireAuth } from '@/lib/auth/permissions';
import { canApproveWorkflowRequests, canSubmitPersonalRequests } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import { getPendingLeaveRequestsForApprover, getPendingLeaveApprovalSummary } from '@/lib/leave/queries';
import LeaveStatusBadge from '@/components/leave/leave-status-badge';
import ApprovalActions from '@/components/leave/approval-actions';
import Link from 'next/link';
import { CheckSquare, Calendar, User, Clock, ArrowRight, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Duyệt đơn nghỉ phép | Tri Thức Việt',
};

export default async function ApprovalsLeavePage({ searchParams }: { searchParams?: { page?: string } }) {
  const user = await requireAuth();

  if (!canApproveWorkflowRequests(user.role)) {
    redirect(canSubmitPersonalRequests(user.role) ? '/leave' : '/');
  }

  const pageSize = 25;
  const pageNumber = Math.max(1, Math.min(100000, Number(searchParams?.page) || 1));
  const [fetchedRequests, summary] = await Promise.all([
    getPendingLeaveRequestsForApprover(user, { limit: pageSize, offset: (pageNumber - 1) * pageSize }),
    getPendingLeaveApprovalSummary(user),
  ]);
  const hasNextPage = fetchedRequests.length > pageSize;
  const pendingRequests = fetchedRequests.slice(0, pageSize);
  const needsActionCount = summary.total;
  const firstLevelCount = summary.firstLevel;
  const finalLevelCount = summary.finalLevel;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Hàng đợi duyệt đơn nghỉ phép
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {needsActionCount} đơn cần xử lý
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Các đơn chưa được xử lý sẽ được ưu tiên hiển thị tại đây. Bạn chỉ nhìn thấy những đơn đang đến đúng bước duyệt của mình.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/approvals/out-office"
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Chuyển sang duyệt Ra ngoài →
          </Link>
        </div>
      </div>

      {needsActionCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-live="polite">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Cần xử lý ngay</p>
            <p className="mt-1 text-2xl font-black text-amber-950">{needsActionCount}</p>
            <p className="text-xs font-medium text-amber-800">đơn đang chờ bạn xem</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Chờ duyệt cấp 1</p>
            <p className="mt-1 text-2xl font-black text-blue-950">{firstLevelCount}</p>
            <p className="text-xs font-medium text-blue-800">đơn chưa được Trưởng phòng duyệt</p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Chờ duyệt cấp 2</p>
            <p className="mt-1 text-2xl font-black text-violet-950">{finalLevelCount}</p>
            <p className="text-xs font-medium text-violet-800">đơn đang chờ Giám đốc duyệt</p>
          </div>
        </div>
      )}

      {pendingRequests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#005a3c] border border-emerald-200 mx-auto flex items-center justify-center">
            <CheckSquare className="w-7 h-7" />
          </div>
              <h3 className="text-base font-bold text-slate-800">Không có đơn chưa duyệt</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            Tuyệt vời! Bạn đã hoàn tất tất cả các yêu cầu phê duyệt đơn nghỉ phép thuộc thẩm quyền của mình.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className={`bg-white rounded-2xl border shadow-xs p-6 hover:shadow-md transition-all space-y-4 ${
                req.status === 'PENDING' ? 'border-amber-300 ring-1 ring-amber-100' : 'border-violet-300 ring-1 ring-violet-100'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#005a3c] border border-emerald-200 flex items-center justify-center font-bold text-sm shrink-0">
                    {req.employee_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{req.employee_name}</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {req.employee_role} • {req.department_name || 'Chưa phân bổ'}{' '}
                      {req.team_name ? `• ${req.team_name}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide ${
                    req.status === 'PENDING' ? 'bg-amber-100 text-amber-900' : 'bg-violet-100 text-violet-900'
                  }`}>
                    {req.status === 'PENDING'
                      ? user.role === 'DIRECTOR' ? 'Chờ Giám đốc duyệt trực tiếp' : 'Chưa duyệt cấp 1'
                      : 'Chưa duyệt cấp 2'}
                  </span>
                  <LeaveStatusBadge status={req.status} />
                  <Link
                    href={`/leave/${req.id}`}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-[#005a3c] bg-emerald-50 hover:bg-[#005a3c] hover:text-white transition-all"
                    title="Xem chi tiết"
                  >
                    Xem đơn
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              </div>

              {/* Thông tin thời gian và lý do */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm bg-slate-50/80 p-4 rounded-xl border border-slate-200/70">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Thời gian nghỉ:
                  </span>
                  <span className="font-bold text-slate-900">
                    {req.start_date} → {req.end_date}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Số ngày làm việc:
                  </span>
                  <span className="font-bold text-[#005a3c] text-base">
                    {req.duration_days} ngày
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Cấp duyệt hiện tại:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {req.status === 'PENDING'
                      ? user.role === 'DIRECTOR' ? 'Giám đốc duyệt trực tiếp' : 'Duyệt Cấp 1 (Trưởng phòng)'
                      : 'Duyệt Cấp 2 (Giám đốc)'}
                  </span>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-700 font-medium">
                <span className="font-bold text-slate-900">Lý do nghỉ: </span>
                {req.reason || '—'}
              </div>

              {/* Khu vực thao tác Duyệt / Từ chối */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-xs text-slate-400">
                  Gửi lúc {new Date(req.created_at).toLocaleString('vi-VN')}
                </span>
                <ApprovalActions requestId={req.id} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
        <span className="text-slate-600">Trang {pageNumber} · {needsActionCount} đơn thuộc hàng đợi</span>
        <div className="flex gap-2">{pageNumber > 1 && <Link href={`/approvals/leave?page=${pageNumber - 1}`} className="rounded-lg border px-3 py-1.5 font-semibold text-slate-700">Trước</Link>}{hasNextPage && <Link href={`/approvals/leave?page=${pageNumber + 1}`} className="rounded-lg border px-3 py-1.5 font-semibold text-slate-700">Tiếp</Link>}</div>
      </div>
    </div>
  );
}
