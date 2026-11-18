import { notFound, redirect } from "next/navigation";
import { requireAuth, canAccessUserData } from "@/lib/auth/permissions";
import {
  getOutOfficeRequestById,
  getOutOfficeApprovalHistory,
} from "@/lib/out-office/queries";
import { getSafeUserById } from "@/lib/db/queries/users";
import { evaluateOutOfficeApproval } from "@/lib/out-office/workflow";
import OutOfficeStatusBadge from "@/components/out-office/out-office-status-badge";
import OutOfficeApprovalActions from "@/components/out-office/approval-actions";
import PendingOutOfficeEditor from "@/components/out-office/pending-request-editor";
import ReturnDocumentForm from "@/components/out-office/return-document-form";
import RequestHistoryTimeline from "@/components/requests/request-history-timeline";
import { getRequestChangeHistory } from "@/lib/admin/queries";
import { formatDateTimeVN } from "@/lib/date-time";
import Link from "next/link";
import {
  Calendar,
  Clock,
  ArrowLeft,
  CheckCircle,
  ShieldAlert,
  Briefcase,
  UserCheck,
} from "lucide-react";

export const metadata = {
  title: "Chi tiết đơn ra ngoài | Leave & Gate Pass",
};

export default async function OutOfficeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const currentUser = await requireAuth();
  const request = await getOutOfficeRequestById(params.id);

  if (!request) {
    notFound();
  }

  const applicant = await getSafeUserById(request.employee_id);
  if (!applicant) {
    notFound();
  }

  // Kiểm tra quyền xem: Chủ đơn, Giám đốc hoặc quản lý trong phạm vi của mình.
  const isOwner = currentUser.id === request.employee_id;
  const hasManagerialAccess = canAccessUserData(currentUser, applicant);

  if (!isOwner && !hasManagerialAccess) {
    redirect("/out-office");
  }

  const [history, changeHistory] = await Promise.all([
    getOutOfficeApprovalHistory(request.id),
    getRequestChangeHistory("OUT_OFFICE", request.id),
  ]);

  // Kế toán chỉ xem (chỉ đọc), không duyệt.
  const isReadOnly = currentUser.role === "ACCOUNTANT";
  const approvalEval = isReadOnly
    ? { allowed: false }
    : evaluateOutOfficeApproval(
        currentUser,
        applicant,
        request.status,
      );
  const canApproveNow = approvalEval.allowed;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link
          href="/out-office"
          className="inline-flex items-center text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Quay lại danh sách
        </Link>
        <OutOfficeStatusBadge status={request.status} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Đơn ra ngoài (Gate Pass) #{request.id.slice(0, 8)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tạo lúc {formatDateTimeVN(request.created_at)}
            </p>
          </div>

          {(canApproveNow || isReadOnly) && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Thao tác duyệt đơn:
              </p>
              {isReadOnly ? (
                <p className="text-xs text-slate-500 italic">
                  Tài khoản Kế toán chỉ xem (chỉ đọc), không phê duyệt.
                </p>
              ) : (
                <OutOfficeApprovalActions
                  requestId={request.id}
                  currentStatus={request.status}
                />
              )}
            </div>
          )}
        </div>

        {/* Thông báo trạng thái */}
        {request.status === "REJECTED" && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Đơn ra ngoài đã bị từ chối
            </div>
            <p className="text-xs text-rose-700">
              <span className="font-medium">Người xử lý:</span>{" "}
              {request.approver_name || "Người có thẩm quyền"}
            </p>
            <p className="text-xs text-rose-700">
              <span className="font-medium">Lý do từ chối:</span>{" "}
              {request.rejection_reason || "Không có lý do chi tiết"}
            </p>
          </div>
        )}

        {request.status === "APPROVED" && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-blue-900 font-semibold text-sm">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              Đơn đã được duyệt cho phép ra ngoài
            </div>
            <p className="text-xs text-blue-700">
              Đơn đã được duyệt. Khi quay về, nhân viên tải giấy xác nhận lên;
              thời điểm tải lên được ghi nhận làm giờ về thực tế.
            </p>
          </div>
        )}

        {request.status === "COMPLETED" && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Đã hoàn tất quy trình ra ngoài
            </div>
            <p className="text-xs text-emerald-700">
              Giấy xác nhận đã được nộp. Thời điểm tải lên được dùng làm giờ về
              thực tế để đối soát.
            </p>
            {request.actual_return_at && (
              <p className="text-xs font-semibold text-emerald-800">
                Giờ về được ghi nhận: {request.actual_return_at}
              </p>
            )}
            {request.return_document_file_name && (
              <a
                href={`/api/out-office/${request.id}/document`}
                className="inline-flex text-xs font-semibold text-emerald-800 underline"
              >
                Tải giấy xác nhận: {request.return_document_file_name}
              </a>
            )}
          </div>
        )}

        {/* Chi tiết */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
              Thông tin nhân sự
            </h3>
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Họ và tên:</span>
                <span className="font-semibold text-slate-900">
                  {request.employee_name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Chức vụ:</span>
                <span className="font-medium text-slate-700">
                  {request.employee_role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Phòng ban:</span>
                <span className="text-slate-700">
                  {request.department_name || "Chưa phân bổ"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Nhóm (Team):</span>
                <span className="text-slate-700">
                  {request.team_name || "Chưa phân bổ"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
              Chi tiết thời gian & Mục đích
            </h3>
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ngày ra ngoài:</span>
                <span className="font-semibold text-slate-900">
                  {request.request_date}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Khung giờ:</span>
                <span className="font-semibold text-slate-900">
                  {request.start_time} → {request.end_time}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Thời lượng dự kiến:</span>
                <span className="font-bold text-blue-700 text-sm">
                  {request.estimated_hours} giờ
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Mục đích:</span>
                <span>
                  {request.reason_type === "WORK" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      <Briefcase className="w-3 h-3" /> Việc công
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                      <UserCheck className="w-3 h-3" /> Việc riêng
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lý do */}
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
            Nội dung lý do
          </h3>
          <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
            {request.reason || "Không có lý do cụ thể."}
          </div>
        </div>
      </div>

      {isOwner && request.status === "PENDING" && (
        <PendingOutOfficeEditor
          request={{
            id: request.id,
            request_date: request.request_date,
            start_time: request.start_time,
            end_time: request.end_time,
            reason_type: request.reason_type,
            reason: request.reason,
          }}
        />
      )}
      {isOwner && request.status === "APPROVED" && (
        <ReturnDocumentForm requestId={request.id} />
      )}
      <RequestHistoryTimeline changes={changeHistory} approvals={history} />
    </div>
  );
}
