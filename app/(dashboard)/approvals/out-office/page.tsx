import { requireAuth } from '@/lib/auth/permissions';
import { canApproveWorkflowRequests, canSubmitPersonalRequests } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import { getPendingOutOfficeRequestsForApprover } from '@/lib/out-office/queries';
import OutOfficeStatusBadge from '@/components/out-office/out-office-status-badge';
import OutOfficeApprovalActions from '@/components/out-office/approval-actions';
import Link from 'next/link';
import { Clock, ArrowRight, Briefcase, UserCheck } from 'lucide-react';

export const metadata = {
  title: 'Duyệt đơn ra ngoài | Tri Thức Việt',
};

export default async function ApprovalsOutOfficePage() {
  const user = await requireAuth();

  if (!canApproveWorkflowRequests(user.role)) {
    redirect(canSubmitPersonalRequests(user.role) ? '/out-office' : '/');
  }

  const pendingRequests = await getPendingOutOfficeRequestsForApprover(user);
  const needsActionCount = pendingRequests.filter((request) => request.status === 'PENDING').length;
  const waitingReturnCount = pendingRequests.filter((request) => request.status === 'APPROVED').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Hàng đợi duyệt đơn ra ngoài
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {needsActionCount} đơn chưa duyệt
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Các đơn chưa duyệt được đánh dấu nổi bật để bạn xử lý trước; các đơn đã duyệt sẽ nằm ở nhóm chờ xác nhận nhân viên đã về.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/approvals/leave"
            className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            ← Chuyển sang duyệt Nghỉ phép
          </Link>
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-live="polite">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Chưa duyệt</p>
            <p className="mt-1 text-2xl font-black text-amber-950">{needsActionCount}</p>
            <p className="text-xs font-medium text-amber-800">đơn cần xử lý trước khi đi</p>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-teal-800">Đang ra ngoài</p>
            <p className="mt-1 text-2xl font-black text-teal-950">{waitingReturnCount}</p>
            <p className="text-xs font-medium text-teal-800">đơn chờ ký xác nhận khi về</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Tổng hàng đợi</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{pendingRequests.length}</p>
            <p className="text-xs font-medium text-slate-600">đơn thuộc thẩm quyền của bạn</p>
          </div>
        </div>
      )}

      {pendingRequests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#005a3c] border border-emerald-200 mx-auto flex items-center justify-center">
            <Clock className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Không có đơn chưa duyệt</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            Hiện tại không có nhân viên nào xin ra ngoài hoặc chờ ký sổ xác nhận về.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className={`bg-white rounded-2xl border shadow-xs p-6 hover:shadow-md transition-all space-y-4 ${
                req.status === 'PENDING' ? 'border-amber-300 ring-1 ring-amber-100' : 'border-teal-300 ring-1 ring-teal-100'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-sm shrink-0">
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
                    req.status === 'PENDING' ? 'bg-amber-100 text-amber-900' : 'bg-teal-100 text-teal-900'
                  }`}>
                    {req.status === 'PENDING' ? 'Chưa duyệt' : 'Chờ xác nhận về'}
                  </span>
                  <OutOfficeStatusBadge status={req.status} />
                  <Link
                    href={`/out-office/${req.id}`}
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
                    Ngày ra ngoài:
                  </span>
                  <span className="font-bold text-slate-900">{req.request_date}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Khung giờ & Thời lượng:
                  </span>
                  <span className="font-bold text-slate-900">
                    {req.start_time} → {req.end_time} ({req.estimated_hours}h)
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Mục đích:
                  </span>
                  <span>
                    {req.reason_type === 'WORK' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        <Briefcase className="w-3.5 h-3.5" /> Việc công
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        <UserCheck className="w-3.5 h-3.5" /> Việc riêng
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-700 font-medium">
                <span className="font-bold text-slate-900">Lý do: </span>
                {req.reason || '—'}
              </div>

              {/* Thao tác Duyệt / Từ chối / Ký sổ */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-xs text-slate-500 font-medium">
                  {req.status === 'PENDING'
                    ? 'Bước 1: Trưởng phòng / Giám đốc duyệt trước khi đi'
                    : 'Bước 2: Xác nhận hoàn tất khi nhân viên đã về'}
                </span>
                <OutOfficeApprovalActions requestId={req.id} currentStatus={req.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
