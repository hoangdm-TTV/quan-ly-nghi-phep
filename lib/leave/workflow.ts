import { SafeUser } from '@/lib/types/user';

export type LeaveStatus =
  | 'PENDING'
  | 'APPROVED_BY_LEAD'
  | 'WAITING_FOR_DOC'
  | 'COMPLETED'
  | 'REJECTED';

export type ApprovalAction = 'APPROVED_LEAD' | 'APPROVED_DIRECTOR' | 'REJECTED';

export interface WorkflowEvaluation {
  allowed: boolean;
  reason?: string;
  nextStatus?: LeaveStatus;
  action?: ApprovalAction;
}

/**
 * Kiểm tra xem người dùng hiện tại có thẩm quyền phê duyệt đơn nghỉ phép hay không
 */
export function evaluateLeaveApproval(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: LeaveStatus,
  durationDays: number
): WorkflowEvaluation {
  // 1. Không cho phép tự phê duyệt đơn của chính mình
  if (approver.id === applicant.id) {
    return {
      allowed: false,
      reason: 'Bạn không được phép tự phê duyệt đơn nghỉ phép của chính mình.',
    };
  }

  // 2. Chỉ xử lý khi đơn ở trạng thái PENDING hoặc APPROVED_BY_LEAD
  if (currentStatus !== 'PENDING' && currentStatus !== 'APPROVED_BY_LEAD') {
    return {
      allowed: false,
      reason: `Đơn đang ở trạng thái "${currentStatus}", không thể thực hiện phê duyệt tiếp.`,
    };
  }

  // 3. Phê duyệt cấp 2 (đơn đã qua bước APPROVED_BY_LEAD): Chỉ GIÁM ĐỐC được duyệt
  if (currentStatus === 'APPROVED_BY_LEAD') {
    if (approver.role === 'DIRECTOR') {
      return {
        allowed: true,
        nextStatus: 'WAITING_FOR_DOC',
        action: 'APPROVED_DIRECTOR',
      };
    }
    return {
      allowed: false,
      reason: 'Đơn này đã được duyệt cấp 1, hiện chỉ có Giám đốc (DIRECTOR) mới có thẩm quyền duyệt cấp 2.',
    };
  }

  // 4. Phê duyệt cấp 1 (đơn đang ở trạng thái PENDING):
  if (currentStatus === 'PENDING') {
    // 4.1 Người tạo đơn là STAFF
    if (applicant.role === 'STAFF') {
      const isLead =
        approver.role === 'TEAM_LEAD' &&
        approver.team_id !== null &&
        approver.team_id === applicant.team_id;

      const isManager =
        approver.role === 'MANAGER' &&
        approver.department_id !== null &&
        approver.department_id === applicant.department_id;

      if (!isLead && !isManager) {
        return {
          allowed: false,
          reason: 'Chỉ Trưởng nhóm (Team Lead) cùng team hoặc Trưởng phòng (Manager) cùng phòng ban mới có quyền duyệt đơn này.',
        };
      }

      // Nếu nghỉ <= 1 ngày -> 1 cấp duyệt -> chuyển thẳng sang WAITING_FOR_DOC
      if (durationDays <= 1) {
        return {
          allowed: true,
          nextStatus: 'WAITING_FOR_DOC',
          action: 'APPROVED_LEAD',
        };
      }

      // Nếu nghỉ >= 2 ngày -> 2 cấp duyệt -> duyệt cấp 1 chuyển sang APPROVED_BY_LEAD
      return {
        allowed: true,
        nextStatus: 'APPROVED_BY_LEAD',
        action: 'APPROVED_LEAD',
      };
    }

    // 4.2 Người tạo đơn là TEAM_LEAD
    if (applicant.role === 'TEAM_LEAD') {
      const isManager =
        approver.role === 'MANAGER' &&
        approver.department_id !== null &&
        approver.department_id === applicant.department_id;

      if (!isManager) {
        return {
          allowed: false,
          reason: 'Đơn của Trưởng nhóm phải do Trưởng phòng (Manager) cùng phòng ban phê duyệt.',
        };
      }

      if (durationDays <= 1) {
        return {
          allowed: true,
          nextStatus: 'WAITING_FOR_DOC',
          action: 'APPROVED_LEAD',
        };
      }

      return {
        allowed: true,
        nextStatus: 'APPROVED_BY_LEAD',
        action: 'APPROVED_LEAD',
      };
    }

    // 4.3 Người tạo đơn là MANAGER hoặc ACCOUNTANT
    if (applicant.role === 'MANAGER' || applicant.role === 'ACCOUNTANT') {
      if (approver.role !== 'DIRECTOR') {
        return {
          allowed: false,
          reason: 'Đơn của Trưởng phòng hoặc Kế toán phải do Giám đốc (DIRECTOR) duyệt trực tiếp.',
        };
      }

      return {
        allowed: true,
        nextStatus: 'WAITING_FOR_DOC',
        action: 'APPROVED_DIRECTOR',
      };
    }

    // 4.4 Người tạo đơn là DIRECTOR
    if (applicant.role === 'DIRECTOR') {
      return {
        allowed: false,
        reason: 'Hệ thống không hỗ trợ luồng duyệt cho Giám đốc.',
      };
    }
  }

  return {
    allowed: false,
    reason: 'Không xác định được thẩm quyền phê duyệt.',
  };
}

/**
 * Kiểm tra xem người dùng hiện tại có thẩm quyền từ chối đơn hay không
 * (Quy tắc tương tự phê duyệt: phải đến lượt mình xử lý và có thẩm quyền)
 */
export function evaluateLeaveRejection(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: LeaveStatus,
  durationDays: number
): { allowed: boolean; reason?: string } {
  const evalResult = evaluateLeaveApproval(approver, applicant, currentStatus, durationDays);
  if (!evalResult.allowed) {
    return { allowed: false, reason: evalResult.reason };
  }
  return { allowed: true };
}
