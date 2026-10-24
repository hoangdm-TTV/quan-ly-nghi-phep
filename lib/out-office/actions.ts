'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db/pool';
import { requireAuth } from '@/lib/auth/permissions';
import { getSafeUserById } from '@/lib/db/queries/users';
import { calculateEstimatedHours } from './calculator';
import { evaluateOutOfficeApproval, evaluateOutOfficeRejection, OutOfficeStatus } from './workflow';

const createOutOfficeSchema = z.object({
  requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ (YYYY-MM-DD)'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ bắt đầu không hợp lệ (HH:MM)'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ kết thúc không hợp lệ (HH:MM)'),
  reasonType: z.enum(['WORK', 'PERSONAL'], {
    errorMap: () => ({ message: 'Vui lòng chọn loại lý do: Công việc hoặc Việc riêng' }),
  }),
  reason: z.string().trim().min(5, 'Lý do xin ra ngoài phải có ít nhất 5 ký tự').max(1000, 'Lý do quá dài'),
});

export type OutOfficeActionState = {
  success?: boolean;
  error?: string;
};

/**
 * Server Action: Tạo đơn xin ra ngoài mới
 */
export async function createOutOfficeRequestAction(
  prevState: OutOfficeActionState | null,
  formData: FormData
): Promise<OutOfficeActionState> {
  const currentUser = await requireAuth();

  // Giám đốc không tạo đơn xin ra ngoài trên hệ thống
  if (currentUser.role === 'DIRECTOR') {
    return { error: 'Tài khoản Giám đốc (DIRECTOR) không tạo đơn ra ngoài trên hệ thống.' };
  }

  const rawDate = formData.get('requestDate');
  const rawStartTime = formData.get('startTime');
  const rawEndTime = formData.get('endTime');
  const rawReasonType = formData.get('reasonType');
  const rawReason = formData.get('reason');

  const validated = createOutOfficeSchema.safeParse({
    requestDate: rawDate,
    startTime: rawStartTime,
    endTime: rawEndTime,
    reasonType: rawReasonType,
    reason: rawReason,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ.' };
  }

  const { requestDate, startTime, endTime, reasonType, reason } = validated.data;

  // 1. Tính số giờ ở server
  let estimatedHours: number;
  try {
    estimatedHours = calculateEstimatedHours(startTime, endTime);
  } catch {
    return { error: 'Khoảng thời gian không hợp lệ.' };
  }

  // 2. Kiểm tra trùng + ghi đơn trong cùng transaction để chống race condition
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const overlapCheck = await client.query(
      `SELECT id FROM out_office_requests
       WHERE employee_id = $1
         AND request_date = $2
         AND status NOT IN ('REJECTED')
         AND start_time < $3
         AND end_time > $4
       LIMIT 1`,
      [currentUser.id, requestDate, endTime, startTime]
    );

    if (overlapCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return { error: 'Bạn đã có một đơn ra ngoài khác trong cùng khoảng thời gian này.' };
    }

    await client.query(
      `INSERT INTO out_office_requests
        (employee_id, request_date, start_time, end_time, estimated_hours, reason_type, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
      [currentUser.id, requestDate, startTime, endTime, estimatedHours, reasonType, reason.trim()]
    );
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Create Gate Pass Error]', error);
    return { error: 'Không thể tạo đơn xin ra ngoài lúc này. Vui lòng thử lại sau.' };
  } finally {
    client.release();
  }

  revalidatePath('/out-office');
  redirect('/out-office');
}

/**
 * Server Action: Phê duyệt đơn xin ra ngoài (hoặc xác nhận hoàn tất khi về)
 */
export async function approveOutOfficeRequestAction(
  prevState: OutOfficeActionState | null,
  formData: FormData
): Promise<OutOfficeActionState> {
  const currentUser = await requireAuth();
  const requestId = formData.get('requestId') as string;
  const comment = (formData.get('comment') as string) || null;

  if (!requestId) {
    return { error: 'Thiếu mã đơn cần phê duyệt.' };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Khóa hàng FOR UPDATE
    const selectRes = await client.query(
      `SELECT id, employee_id, status 
       FROM out_office_requests 
       WHERE id = $1 
       FOR UPDATE`,
      [requestId]
    );

    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy đơn xin ra ngoài.' };
    }

    const request = selectRes.rows[0];
    const applicant = await getSafeUserById(request.employee_id);

    if (!applicant) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy thông tin nhân viên tạo đơn.' };
    }

    const evaluation = evaluateOutOfficeApproval(currentUser, applicant, request.status as OutOfficeStatus);

    if (!evaluation.allowed || !evaluation.nextStatus || !evaluation.action) {
      await client.query('ROLLBACK');
      return { error: evaluation.reason || 'Bạn không có thẩm quyền xử lý đơn này.' };
    }

    await client.query(
      `UPDATE out_office_requests 
       SET status = $1, approver_id = $2, updated_at = NOW() 
       WHERE id = $3`,
      [evaluation.nextStatus, currentUser.id, requestId]
    );

    await client.query(
      `INSERT INTO approval_history (request_type, request_id, approver_id, action, comment) 
       VALUES ('OUT_OFFICE', $1, $2, $3, $4)`,
      [requestId, currentUser.id, evaluation.action, comment]
    );

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Approve Gate Pass Error]', error);
    return { error: 'Có lỗi xảy ra khi phê duyệt đơn. Vui lòng thử lại sau.' };
  } finally {
    client.release();
  }

  revalidatePath('/approvals/out-office');
  revalidatePath(`/out-office/${requestId}`);
  return { success: true };
}

/**
 * Server Action: Từ chối đơn xin ra ngoài
 */
export async function rejectOutOfficeRequestAction(
  prevState: OutOfficeActionState | null,
  formData: FormData
): Promise<OutOfficeActionState> {
  const currentUser = await requireAuth();
  const requestId = formData.get('requestId') as string;
  const rejectionReason = (formData.get('rejectionReason') as string)?.trim();

  if (!requestId) {
    return { error: 'Thiếu mã đơn cần từ chối.' };
  }

  if (!rejectionReason || rejectionReason.length < 5) {
    return { error: 'Bắt buộc phải nhập lý do từ chối cụ thể (tối thiểu 5 ký tự).' };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const selectRes = await client.query(
      `SELECT id, employee_id, status 
       FROM out_office_requests 
       WHERE id = $1 
       FOR UPDATE`,
      [requestId]
    );

    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy đơn xin ra ngoài.' };
    }

    const request = selectRes.rows[0];
    const applicant = await getSafeUserById(request.employee_id);

    if (!applicant) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy thông tin nhân viên tạo đơn.' };
    }

    const evaluation = evaluateOutOfficeRejection(currentUser, applicant, request.status as OutOfficeStatus);

    if (!evaluation.allowed) {
      await client.query('ROLLBACK');
      return { error: evaluation.reason || 'Bạn không có thẩm quyền từ chối đơn này.' };
    }

    await client.query(
      `UPDATE out_office_requests 
       SET status = 'REJECTED', approver_id = $1, rejection_reason = $2, updated_at = NOW() 
       WHERE id = $3`,
      [currentUser.id, rejectionReason, requestId]
    );

    await client.query(
      `INSERT INTO approval_history (request_type, request_id, approver_id, action, comment) 
       VALUES ('OUT_OFFICE', $1, $2, 'REJECTED', $3)`,
      [requestId, currentUser.id, rejectionReason]
    );

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Reject Gate Pass Error]', error);
    return { error: 'Có lỗi xảy ra khi từ chối đơn. Vui lòng thử lại sau.' };
  } finally {
    client.release();
  }

  revalidatePath('/approvals/out-office');
  revalidatePath(`/out-office/${requestId}`);
  return { success: true };
}
