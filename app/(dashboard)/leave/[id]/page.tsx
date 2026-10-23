import { notFound, redirect } from 'next/navigation';
import { requireAuth, canAccessUserData } from '@/lib/auth/permissions';
import { getLeaveRequestById, getLeaveApprovalHistory } from '@/lib/leave/queries';
import { evaluateLeaveApproval } from '@/lib/leave/workflow';
import { getSafeUserById } from '@/lib/db/queries/users';
import LeaveStatusBadge from '@/components/leave/leave-status-badge';
import ApprovalActions from '@/components/leave/approval-actions';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  User,
  Building2,
  FileText,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  History,
  ShieldAlert,
} from 'lucide-react';

export const metadata = {
  title: 'Chi tiết đơn nghỉ phép | Leave & Gate Pass',
};

export default async function LeaveDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const currentUser = await requireAuth();
  const request = await getLeaveRequestById(params.id);

  if (!request) {
    notFound();
  }

  const applicant = await getSafeUserById(request.employee_id);
  if (!applicant) {
    notFound();
  }

  // Kiểm tra quyền xem: Chỉ chủ đơn hoặc người có thẩm quyền quản lý mới được xem
  const isOwner = currentUser.id === request.employee_id;
  const hasManagerialAccess = canAccessUserData(currentUser, applicant);

  if (!isOwner && !hasManagerialAccess) {
    redirect('/leave');
  }

  const history = await getLeaveApprovalHistory(request.id);

  // Kiểm tra xem người đang xem có thẩm quyền duyệt đơn này tại thời điểm hiện tại không
  const approvalEvaluation = evaluateLeaveApproval(
    currentUser,
    applicant,
    request.status,
    request.duration_days
  );
  const canApproveNow = approvalEvaluation.allowed;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Nút quay lại */}
      <div className="flex items-center justify-between">
        <Link
          href="/leave"
          className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Quay lại danh sách
        </Link>
        <LeaveStatusBadge status={request.status} />
      </div>

      {/* Thông tin chính của đơn */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Đơn xin nghỉ phép #{request.id.slice(0, 8)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tạo lúc {new Date(request.created_at).toLocaleString('vi-VN')}
            </p>
          </div>

          {canApproveNow && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">Thao tác xử lý đơn:</p>
              <ApprovalActions requestId={request.id} />
            </div>
          )}
        </div>

        {/* Thông báo trạng thái đặc biệt */}
        {request.status === 'REJECTED' && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Đơn nghỉ phép này đã bị từ chối
            </div>
            <p className="text-xs text-rose-700">
              <span className="font-medium">Người từ chối:</span> {request.approver_name || 'Người quản lý'}
            </p>
            <p className="text-xs text-rose-700">
              <span className="font-medium">Lý do từ chối:</span> {request.rejection_reason || 'Không có lý do chi tiết'}
            </p>
          </div>
        )}

        {request.status === 'WAITING_FOR_DOC' && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-purple-900 font-semibold text-sm">
              <CheckCircle className="w-4 h-4 text-purple-600" />
              Đơn đã được phê duyệt đầy đủ các cấp
            </div>
            <p className="text-xs text-purple-700">
              Bước tiếp theo: Nhân viên in mẫu giấy xin nghỉ phép, xin chữ ký quản lý và tải ảnh lên hệ thống để hoàn tất (tính năng tải file sẽ khả dụng ở giai đoạn sau).
            </p>
          </div>
        )}

        {/* Lưới thông tin chi tiết */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
              Thông tin nhân sự
            </h3>
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Họ và tên:</span>
                <span className="font-semibold text-slate-900">{request.employee_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vai trò:</span>
                <span className="font-medium text-slate-700">{request.employee_role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Phòng ban:</span>
                <span className="text-slate-700">{request.department_name || 'Chưa phân bổ'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Nhóm (Team):</span>
                <span className="text-slate-700">{request.team_name || 'Chưa phân bổ'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
              Chi tiết kỳ nghỉ
            </h3>
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Khoảng thời gian:</span>
                <span className="font-semibold text-slate-900">
                  {request.start_date} → {request.end_date}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Số ngày làm việc:</span>
                <span className="font-bold text-blue-700 text-sm">
                  {request.duration_days} ngày
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Quy trình duyệt:</span>
                <span className="text-slate-700">
                  {request.duration_days <= 1 ? '1 cấp duyệt' : '2 cấp duyệt (Cấp 1 + Giám đốc)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Cập nhật lần cuối:</span>
                <span className="text-slate-700">
                  {new Date(request.updated_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lý do nghỉ */}
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
            Lý do xin nghỉ phép
          </h3>
          <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
            {request.reason || 'Không có lý do cụ thể.'}
          </div>
        </div>
      </div>

      {/* Lịch sử phê duyệt */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <History className="w-4 h-4 text-blue-600" />
          Tiến trình & Lịch sử phê duyệt
        </h3>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">
            Đơn đang chờ cấp phê duyệt đầu tiên tiếp nhận xử lý.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((h, idx) => (
              <div
                key={h.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 text-xs"
              >
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <p className="font-semibold text-slate-900">
                      {h.approver_name} ({h.approver_role})
                    </p>
                    <span className="text-[11px] text-slate-400">
                      {new Date(h.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-slate-600">
                    <span className="font-medium">Hành động:</span>{' '}
                    {h.action === 'APPROVED_LEAD'
                      ? 'Đã duyệt Cấp 1 (Trưởng nhóm / Trưởng phòng)'
                      : h.action === 'APPROVED_DIRECTOR'
                      ? 'Đã duyệt Cấp 2 (Giám đốc hoàn tất phê duyệt)'
                      : 'Đã từ chối đơn'}
                  </p>
                  {h.comment && (
                    <p className="text-slate-600 italic bg-white p-2 rounded border border-slate-200 mt-1">
                      "{h.comment}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
