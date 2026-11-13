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

/**
 * Nghỉ dưới 2 ngày: Manager duyệt một cấp (Director chỉ có nhánh dự phòng).
 * Nghỉ từ 2 ngày: Manager có thể duyệt cấp 1 rồi chuyển Director; Director
 * cũng có thể duyệt trực tiếp PENDING và bỏ qua bước Manager. Đơn của chính
 * Director do manager_id duyệt một lần để tránh yêu cầu Director tự duyệt.
 */
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

  if (currentStatus === "APPROVED_BY_LEAD") {
    if (approver.role !== "DIRECTOR") {
      return {
        allowed: false,
        reason: "Đơn đã qua cấp 1; chỉ Giám đốc được duyệt cấp cuối.",
      };
    }
    if (durationDays < 2) {
      return {
        allowed: false,
        reason: "Chỉ đơn nghỉ từ 2 ngày trở lên mới cần bước duyệt cấp 2.",
      };
    }
    return {
      allowed: true,
      nextStatus: "WAITING_FOR_DOC",
      action: "APPROVED_DIRECTOR",
    };
  }

  if (currentStatus !== "PENDING") {
    return {
      allowed: false,
      reason: `Đơn đang ở trạng thái "${currentStatus}", không thể thực hiện phê duyệt tiếp.`,
    };
  }

  if (
    approver.role === "DIRECTOR" &&
    applicant.role !== "DIRECTOR" &&
    durationDays >= 2
  ) {
    return {
      allowed: true,
      nextStatus: "WAITING_FOR_DOC",
      action: "APPROVED_DIRECTOR",
    };
  }

  if (applicant.manager_id !== approver.id) {
    return { allowed: false, reason: "Đơn này không được gán cho bạn phê duyệt." };
  }

  if (approver.role === "MANAGER") {
    return {
      allowed: true,
      nextStatus:
        applicant.role === "DIRECTOR" || durationDays < 2
          ? "WAITING_FOR_DOC"
          : "APPROVED_BY_LEAD",
      action: "APPROVED_LEAD",
    };
  }

  if (
    approver.role === "DIRECTOR" &&
    (directorDirectApproval || applicant.role === "MANAGER" || applicant.role === "DIRECTOR")
  ) {
    return {
      allowed: true,
      nextStatus: "WAITING_FOR_DOC",
      action: "APPROVED_DIRECTOR",
    };
  }

  return {
    allowed: false,
    reason: "Chỉ Trưởng phòng hoặc Giám đốc được xử lý đơn nghỉ phép ở bước hiện tại.",
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
