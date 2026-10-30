import { SafeUser } from '@/lib/types/user';

export type OutOfficeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export type OutOfficeReasonType = 'WORK' | 'PERSONAL';

export interface OutOfficeEvaluation {
  allowed: boolean;
  reason?: string;
  nextStatus?: OutOfficeStatus;
  action?: 'APPROVED_LEAD' | 'APPROVED_DIRECTOR' | 'REJECTED';
}

export type OutOfficeRoutingAvailability = { hasTeamLead: boolean; hasManager: boolean };

function isAssignedOutOfficeApprover(
  approver: SafeUser,
  applicant: SafeUser,
  routing: OutOfficeRoutingAvailability,
): boolean {
  if (applicant.role === 'STAFF') {
    if (routing.hasTeamLead) {
      return approver.role === 'TEAM_LEAD'
        && Boolean(applicant.team_id)
        && approver.team_id === applicant.team_id;
    }
    if (routing.hasManager) {
      return approver.role === 'MANAGER'
        && Boolean(applicant.department_id)
        && approver.department_id === applicant.department_id;
    }
    return approver.role === 'DIRECTOR';
  }
  if (applicant.role === 'TEAM_LEAD' || applicant.role === 'ACCOUNTANT') {
    if (routing.hasManager) {
      return approver.role === 'MANAGER'
        && Boolean(applicant.department_id)
        && approver.department_id === applicant.department_id;
    }
    return approver.role === 'DIRECTOR';
  }
  return applicant.role === 'MANAGER' && approver.role === 'DIRECTOR';
}

/** Mỗi đơn ra ngoài chỉ cần một người duyệt theo cấp trực tiếp của người tạo. */
export function evaluateOutOfficeApproval(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: OutOfficeStatus,
  existingApproverId?: string | null,
  routing: OutOfficeRoutingAvailability = { hasTeamLead: true, hasManager: true },
): OutOfficeEvaluation {
  if (approver.id === applicant.id) {
    return { allowed: false, reason: 'Bạn không được phép tự phê duyệt đơn ra ngoài của chính mình.' };
  }
  if (currentStatus === 'PENDING') {
    if (!isAssignedOutOfficeApprover(approver, applicant, routing)) {
      return { allowed: false, reason: 'Đơn này không thuộc cấp duyệt trực tiếp của bạn.' };
    }
    return {
      allowed: true,
      nextStatus: 'APPROVED',
      action: approver.role === 'DIRECTOR' ? 'APPROVED_DIRECTOR' : 'APPROVED_LEAD',
    };
  }
  if (currentStatus === 'APPROVED') {
    if (existingApproverId !== approver.id) {
      return { allowed: false, reason: 'Chỉ người đã duyệt đơn mới được xác nhận khi nhân viên quay về.' };
    }
    const action = approver.role === 'DIRECTOR' ? 'APPROVED_DIRECTOR' : 'APPROVED_LEAD';
    return { allowed: true, nextStatus: 'COMPLETED', action };
  }
  return {
    allowed: false,
    reason: `Đơn đang ở trạng thái "${currentStatus}", không thể thực hiện phê duyệt tiếp.`,
  };
}

/** Từ chối đơn ra ngoài phải cùng người xử lý được phép của request. */
export function evaluateOutOfficeRejection(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: OutOfficeStatus,
  existingApproverId?: string | null,
  routing: OutOfficeRoutingAvailability = { hasTeamLead: true, hasManager: true },
): { allowed: boolean; reason?: string } {
  if (approver.id === applicant.id) {
    return { allowed: false, reason: 'Bạn không thể từ chối đơn của chính mình.' };
  }
  if (currentStatus === 'PENDING' && !isAssignedOutOfficeApprover(approver, applicant, routing)) {
    return { allowed: false, reason: 'Đơn này không thuộc cấp duyệt trực tiếp của bạn.' };
  }
  if (currentStatus === 'APPROVED' && existingApproverId !== approver.id) {
    return { allowed: false, reason: 'Chỉ người đã duyệt đơn mới được xử lý đơn này.' };
  }
  if (currentStatus !== 'PENDING' && currentStatus !== 'APPROVED') {
    return { allowed: false, reason: `Không thể từ chối đơn đang ở trạng thái "${currentStatus}".` };
  }
  return { allowed: true };
}
