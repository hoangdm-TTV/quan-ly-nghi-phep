import { SafeUser } from '@/lib/types/user';

export type OutOfficeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type OutOfficeReasonType = 'WORK' | 'PERSONAL';

export interface OutOfficeEvaluation {
  allowed: boolean;
  reason?: string;
  nextStatus?: OutOfficeStatus;
  action?: 'APPROVED_LEAD' | 'APPROVED_DIRECTOR' | 'REJECTED';
}

/**
 * Đánh giá thẩm quyền duyệt đơn ra ngoài
 * Theo quy định doanh nghiệp: Đơn ra ngoài do Kế toán (ACCOUNTANT) hoặc Giám đốc (DIRECTOR) duyệt.
 */
export function evaluateOutOfficeApproval(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: OutOfficeStatus
): OutOfficeEvaluation {
  // 1. Không cho phép tự duyệt đơn của chính mình
  if (approver.id === applicant.id) {
    return {
      allowed: false,
      reason: 'Bạn không được phép tự phê duyệt đơn ra ngoài của chính mình.',
    };
  }

  // 2. Chỉ Kế toán (ACCOUNTANT) hoặc Giám đốc (DIRECTOR) có quyền duyệt đơn ra ngoài
  if (approver.role !== 'ACCOUNTANT' && approver.role !== 'DIRECTOR') {
    return {
      allowed: false,
      reason: 'Chỉ phòng Kế toán (ACCOUNTANT) hoặc Giám đốc (DIRECTOR) mới có thẩm quyền duyệt đơn ra ngoài.',
    };
  }

  // 3. Phê duyệt trước khi đi: PENDING -> APPROVED
  if (currentStatus === 'PENDING') {
    return {
      allowed: true,
      nextStatus: 'APPROVED',
      action: approver.role === 'DIRECTOR' ? 'APPROVED_DIRECTOR' : 'APPROVED_LEAD',
    };
  }

  // 4. Xác nhận hoàn tất sau khi về và ký giấy: APPROVED -> COMPLETED
  if (currentStatus === 'APPROVED') {
    return {
      allowed: true,
      nextStatus: 'COMPLETED',
      action: approver.role === 'DIRECTOR' ? 'APPROVED_DIRECTOR' : 'APPROVED_LEAD',
    };
  }

  return {
    allowed: false,
    reason: `Đơn đang ở trạng thái "${currentStatus}", không thể thực hiện phê duyệt tiếp.`,
  };
}

/**
 * Đánh giá thẩm quyền từ chối đơn ra ngoài
 */
export function evaluateOutOfficeRejection(
  approver: SafeUser,
  applicant: SafeUser,
  currentStatus: OutOfficeStatus
): { allowed: boolean; reason?: string } {
  if (approver.id === applicant.id) {
    return {
      allowed: false,
      reason: 'Bạn không thể từ chối đơn của chính mình.',
    };
  }

  if (approver.role !== 'ACCOUNTANT' && approver.role !== 'DIRECTOR') {
    return {
      allowed: false,
      reason: 'Chỉ phòng Kế toán hoặc Giám đốc mới có thẩm quyền từ chối đơn ra ngoài.',
    };
  }

  if (currentStatus !== 'PENDING' && currentStatus !== 'APPROVED') {
    return {
      allowed: false,
      reason: `Không thể từ chối đơn đang ở trạng thái "${currentStatus}".`,
    };
  }

  return { allowed: true };
}
