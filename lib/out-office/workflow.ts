import { SafeUser } from '@/lib/types/user';

export type OutOfficeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type OutOfficeReasonType = 'WORK' | 'PERSONAL';

export interface OutOfficeEvaluation {
  allowed: boolean;
  reason?: string;
  nextStatus?: OutOfficeStatus;
  action?: 'APPROVED_LEAD' | 'APPROVED_DIRECTOR' | 'REJECTED';
}

function canManageOutOffice(approver: SafeUser, applicant: SafeUser): boolean {
  if (approver.role === 'DIRECTOR') return true;
  // Trưởng phòng chỉ duyệt đơn của nhân viên có manager_id trỏ trực tiếp tới mình.
  return (
    approver.role === 'MANAGER' &&
    Boolean(applicant.manager_id) &&
    approver.id === applicant.manager_id &&
    (applicant.role === 'STAFF' || applicant.role === 'TEAM_LEAD' || applicant.role === 'ACCOUNTANT')
  );
}

/** Trưởng phòng (manager_id trực tiếp) xử lý đơn; Giám đốc có quyền toàn công ty. */
export function evaluateOutOfficeApproval(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: OutOfficeStatus
): OutOfficeEvaluation {
  if (approver.id === applicant.id) {
    return { allowed: false, reason: 'Bạn không được phép tự phê duyệt đơn ra ngoài của chính mình.' };
  }
  if (!canManageOutOffice(approver, applicant)) {
    return { allowed: false, reason: 'Đơn ra ngoài chỉ do Trưởng phòng trực tiếp (manager_id) hoặc Giám đốc xử lý.' };
  }

  const action = approver.role === 'DIRECTOR' ? 'APPROVED_DIRECTOR' : 'APPROVED_LEAD';
  if (currentStatus === 'PENDING') {
    return { allowed: true, nextStatus: 'APPROVED', action };
  }
  if (currentStatus === 'APPROVED') {
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
  currentStatus: OutOfficeStatus
): { allowed: boolean; reason?: string } {
  if (approver.id === applicant.id) {
    return { allowed: false, reason: 'Bạn không thể từ chối đơn của chính mình.' };
  }
  if (!canManageOutOffice(approver, applicant)) {
    return { allowed: false, reason: 'Đơn ra ngoài chỉ do Trưởng phòng trực tiếp (manager_id) hoặc Giám đốc xử lý.' };
  }
  if (currentStatus !== 'PENDING' && currentStatus !== 'APPROVED') {
    return { allowed: false, reason: `Không thể từ chối đơn đang ở trạng thái "${currentStatus}".` };
  }
  return { allowed: true };
}
