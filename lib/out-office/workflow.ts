import { SafeUser } from "@/lib/types/user";

export type OutOfficeStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
export type OutOfficeReasonType = "WORK" | "PERSONAL";
export type OutOfficeEvaluation = {
  allowed: boolean;
  reason?: string;
  nextStatus?: OutOfficeStatus;
  action?: "APPROVED_LEAD" | "APPROVED_DIRECTOR" | "REJECTED";
};

/** Một đơn ra ngoài chỉ có một người duyệt, lấy từ users.manager_id. */
export function evaluateOutOfficeApproval(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: OutOfficeStatus,
  existingApproverId?: string | null,
): OutOfficeEvaluation {
  if (approver.id === applicant.id) {
    return { allowed: false, reason: "Bạn không được phép tự phê duyệt đơn ra ngoài của chính mình." };
  }
  if (currentStatus === "PENDING") {
    if (applicant.manager_id !== approver.id) {
      return { allowed: false, reason: "Đơn này không được gán cho bạn phê duyệt." };
    }
    return {
      allowed: true,
      nextStatus: "APPROVED",
      action: approver.role === "DIRECTOR" ? "APPROVED_DIRECTOR" : "APPROVED_LEAD",
    };
  }
  if (currentStatus === "APPROVED") {
    if (existingApproverId !== approver.id) {
      return { allowed: false, reason: "Chỉ người đã duyệt đơn mới được xác nhận khi nhân viên quay về." };
    }
    return {
      allowed: true,
      nextStatus: "COMPLETED",
      action: approver.role === "DIRECTOR" ? "APPROVED_DIRECTOR" : "APPROVED_LEAD",
    };
  }
  return { allowed: false, reason: `Đơn đang ở trạng thái "${currentStatus}", không thể thực hiện phê duyệt.` };
}

export function evaluateOutOfficeRejection(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: OutOfficeStatus,
  existingApproverId?: string | null,
): { allowed: boolean; reason?: string } {
  if (approver.id === applicant.id) {
    return { allowed: false, reason: "Bạn không thể từ chối đơn của chính mình." };
  }
  if (currentStatus === "PENDING" && applicant.manager_id !== approver.id) {
    return { allowed: false, reason: "Đơn này không được gán cho bạn phê duyệt." };
  }
  if (currentStatus === "APPROVED" && existingApproverId !== approver.id) {
    return { allowed: false, reason: "Chỉ người đã duyệt đơn mới được xử lý đơn này." };
  }
  if (currentStatus !== "PENDING" && currentStatus !== "APPROVED") {
    return { allowed: false, reason: `Không thể từ chối đơn đang ở trạng thái "${currentStatus}".` };
  }
  return { allowed: true };
}
