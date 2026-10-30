import { SafeUser } from '@/lib/types/user';

export type LeaveStatus =
  | 'PENDING'
  | 'APPROVED_BY_LEAD'
  | 'WAITING_FOR_DOC'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type ApprovalAction = 'APPROVED_LEAD' | 'APPROVED_DIRECTOR' | 'REJECTED';

export interface WorkflowEvaluation {
  allowed: boolean;
  reason?: string;
  nextStatus?: LeaveStatus;
  action?: ApprovalAction;
}

/** Kiểm tra quyền và bước tiếp theo của workflow nghỉ phép. */
export function evaluateLeaveApproval(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: LeaveStatus,
  durationDays: number,
  directorDirectApproval = false
): WorkflowEvaluation {
  if (approver.id === applicant.id) {
    return { allowed: false, reason: 'Bạn không được phép tự phê duyệt đơn nghỉ phép của chính mình.' };
  }

  if (currentStatus !== 'PENDING' && currentStatus !== 'APPROVED_BY_LEAD') {
    return {
      allowed: false,
      reason: `Đơn đang ở trạng thái "${currentStatus}", không thể thực hiện phê duyệt tiếp.`,
    };
  }

  // Đơn nhiều ngày đã qua cấp Trưởng phòng: chỉ Giám đốc duyệt cấp cuối.
  if (currentStatus === 'APPROVED_BY_LEAD') {
    return approver.role === 'DIRECTOR'
      ? { allowed: true, nextStatus: 'WAITING_FOR_DOC', action: 'APPROVED_DIRECTOR' }
      : {
          allowed: false,
          reason: 'Đơn đã được Trưởng phòng duyệt cấp 1; chỉ Giám đốc mới có quyền duyệt cấp 2.',
        };
  }

  if (directorDirectApproval && approver.role === 'DIRECTOR' && currentStatus === 'PENDING') {
    return { allowed: true, nextStatus: 'WAITING_FOR_DOC', action: 'APPROVED_DIRECTOR' };
  }

  if (applicant.role === 'STAFF' || applicant.role === 'TEAM_LEAD' || applicant.role === 'ACCOUNTANT') {
    // Trưởng phòng duyệt đơn của nhân viên trong cùng phòng ban.
    const isDepartmentManager =
      approver.role === 'MANAGER' &&
      Boolean(approver.department_id) &&
      approver.department_id === applicant.department_id;

    if (!isDepartmentManager) {
      return {
        allowed: false,
        reason: durationDays > 1
          ? 'Đơn nghỉ nhiều ngày phải được Trưởng phòng cùng phòng ban duyệt cấp 1 trước.'
          : 'Đơn nghỉ phải do Trưởng phòng cùng phòng ban duyệt cấp 1.',
      };
    }

    if (durationDays <= 1) {
      return { allowed: true, nextStatus: 'WAITING_FOR_DOC', action: 'APPROVED_LEAD' };
    }
    return { allowed: true, nextStatus: 'APPROVED_BY_LEAD', action: 'APPROVED_LEAD' };
  }

  // Đơn của Manager được Director xử lý trực tiếp.
  if (applicant.role === 'MANAGER') {
    return approver.role === 'DIRECTOR'
      ? { allowed: true, nextStatus: 'WAITING_FOR_DOC', action: 'APPROVED_DIRECTOR' }
      : { allowed: false, reason: 'Đơn của Trưởng phòng phải do Giám đốc duyệt trực tiếp.' };
  }

  return { allowed: false, reason: 'Không xác định được thẩm quyền phê duyệt.' };
}

/** Từ chối tuân theo cùng lượt và cùng thẩm quyền như phê duyệt. */
export function evaluateLeaveRejection(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: LeaveStatus,
  durationDays: number,
  directorDirectApproval = false
): { allowed: boolean; reason?: string } {
  const result = evaluateLeaveApproval(approver, applicant, currentStatus, durationDays, directorDirectApproval);
  return result.allowed ? { allowed: true } : { allowed: false, reason: result.reason };
}
