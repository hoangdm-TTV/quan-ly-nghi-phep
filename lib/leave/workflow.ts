import { SafeUser } from "@/lib/types/user";

export type LeaveStatus =
  | "PENDING"
  | "APPROVED_BY_LEAD"
  | "WAITING_FOR_DOC"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type ApprovalAction = "APPROVED_LEAD" | "APPROVED_DIRECTOR" | "REJECTED";

export interface WorkflowEvaluation {
  allowed: boolean;
  reason?: string;
  nextStatus?: LeaveStatus;
  action?: ApprovalAction;
}

/** Kiểm tra người duyệt được gán trực tiếp trong users.manager_id. */
export function evaluateLeaveApproval(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: LeaveStatus,
  durationDays: number,
  directorDirectApproval = false,
): WorkflowEvaluation {
  if (approver.id === applicant.id) {
    return {
      allowed: false,
      reason: "Bạn không được phép tự phê duyệt đơn nghỉ phép của chính mình.",
    };
  }

  if (currentStatus !== "PENDING") {
    return {
      allowed: false,
      reason: `Đơn đang ở trạng thái "${currentStatus}", không thể thực hiện phê duyệt tiếp.`,
    };
  }

  if (applicant.manager_id !== approver.id) {
    return { allowed: false, reason: "Đơn này không được gán cho bạn phê duyệt." };
  }

  return {
    allowed: true,
    nextStatus: "WAITING_FOR_DOC",
    action: approver.role === "DIRECTOR" ? "APPROVED_DIRECTOR" : "APPROVED_LEAD",
  };
}

/** Từ chối tuân theo cùng lượt và cùng thẩm quyền như phê duyệt. */
export function evaluateLeaveRejection(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: LeaveStatus,
  durationDays: number,
  directorDirectApproval = false,
): { allowed: boolean; reason?: string } {
  const result = evaluateLeaveApproval(
    approver,
    applicant,
    currentStatus,
    durationDays,
    directorDirectApproval,
  );
  return result.allowed
    ? { allowed: true }
    : { allowed: false, reason: result.reason };
}
