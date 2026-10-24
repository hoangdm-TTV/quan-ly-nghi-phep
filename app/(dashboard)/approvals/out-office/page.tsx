import { requireAuth } from '@/lib/auth/permissions';
import { canApproveWorkflowRequests, canSubmitPersonalRequests } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import { getPendingOutOfficeRequestsForApprover } from '@/lib/out-office/queries';
import OutOfficeStatusBadge from '@/components/out-office/out-office-status-badge';
import OutOfficeApprovalActions from '@/components/out-office/approval-actions';
import Link from 'next/link';
import { Clock, ArrowRight, Briefcase, UserCheck } from 'lucide-react';

export const metadata = {
  title: 'Hàng đợi duyệt đơn ra ngoài | Leave & Gate Pass',
};

export default async function ApprovalsOutOfficePage() {
  const user = await requireAuth();

  if (!canApproveWorkflowRequests(user.role)) {
    redirect(canSubmitPersonalRequests(user.role) ? '/out-office' : '/');
  }

  const pendingRequests = await getPendingOutOfficeRequestsForApprover(user);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Hàng đợi duyệt đơn ra ngoài</h2>
        <p className="text-xs text-slate-500 mt-1">
          Duyệt đơn trước khi nhân viên ra ngoài và xác nhận ký sổ hoàn tất khi nhân viên quay lại.
        </p>
      </div>

      {pendingRequests.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Không có đơn nào chờ xử lý</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Hiện tại không có nhân viên nào xin ra ngoài hoặc chờ ký sổ xác nhận về.
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
                  <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
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
                  <OutOfficeStatusBadge status={req.status} />
                  <Link
                    href={`/out-office/${req.id}`}
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
                  <span className="text-slate-500 block">Ngày ra ngoài:</span>
                  <span className="font-semibold text-slate-900">{req.request_date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Khung giờ & Thời lượng:</span>
                  <span className="font-semibold text-slate-900">
                    {req.start_time} → {req.end_time} ({req.estimated_hours}h)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Mục đích:</span>
                  <span>
                    {req.reason_type === 'WORK' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
                        <Briefcase className="w-3 h-3" /> Việc công (WORK)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700">
                        <UserCheck className="w-3 h-3" /> Việc riêng (PERSONAL)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-700">
                <span className="font-medium text-slate-900">Lý do: </span>
                {req.reason || '—'}
              </div>

              {/* Thao tác Duyệt / Từ chối / Ký sổ */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  {req.status === 'PENDING' ? 'Bước 1: Trưởng phòng/Giám đốc duyệt trước khi đi' : 'Bước 2: Xác nhận hoàn tất khi nhân viên đã về'}
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
