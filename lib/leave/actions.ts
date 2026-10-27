'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { PoolClient } from 'pg';
import { pool } from '@/lib/db/pool';
import { requireAuth } from '@/lib/auth/permissions';
import { getSafeUserById, hasActiveManagerForDepartment } from '@/lib/db/queries/users';
import { calculateWorkingDaysWithHolidays } from './calculator';
import { evaluateLeaveApproval, evaluateLeaveRejection, LeaveStatus } from './workflow';

const createLeaveSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu không hợp lệ (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc không hợp lệ (YYYY-MM-DD)'),
  reason: z.string().trim().min(5, 'Lý do nghỉ phép phải có ít nhất 5 ký tự').max(1000, 'Lý do quá dài'),
});

export type LeaveActionState = {
  success?: boolean;
  error?: string;
};

const MAX_LEAVE_DOCUMENT_SIZE = 50 * 1024 * 1024;

/** Chủ đơn nộp giấy đã ký sau khi được duyệt; tệp và trạng thái được lưu cùng một transaction. */
export async function uploadLeaveDocumentAction(
  _prevState: LeaveActionState | null,
  formData: FormData
): Promise<LeaveActionState> {
  const currentUser = await requireAuth();
  if (currentUser.role === 'DIRECTOR') {
    return { error: 'Tài khoản này không có quyền nộp giấy nghỉ phép.' };
  }

  const parsedRequestId = z.string().uuid().safeParse(formData.get('requestId'));
  if (!parsedRequestId.success) return { error: 'Mã đơn nghỉ phép không hợp lệ.' };
  const requestId = parsedRequestId.data;

  const fileValue = formData.get('documentFile');
  if (!fileValue || typeof fileValue === 'string') {
    return { error: 'Vui lòng chọn ảnh hoặc PDF giấy nghỉ phép đã ký.' };
  }
  const file = fileValue as File;
  if (file.size <= 0 || file.size > MAX_LEAVE_DOCUMENT_SIZE) {
    return { error: 'Tệp phải có dung lượng lớn hơn 0 và không vượt quá 50 MB.' };
  }
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) {
    return { error: 'Chỉ chấp nhận tệp PDF, PNG hoặc JPEG.' };
  }

  let documentBytes: Buffer;
  try {
    documentBytes = Buffer.from(await file.arrayBuffer());
  } catch {
    return { error: 'Không thể đọc tệp đã chọn. Vui lòng thử lại.' };
  }

  const isPdf = file.type === 'application/pdf' && documentBytes.subarray(0, 5).toString('ascii') === '%PDF-';
  const isPng = file.type === 'image/png' && documentBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = file.type === 'image/jpeg' && documentBytes.length >= 3 && documentBytes[0] === 0xff && documentBytes[1] === 0xd8 && documentBytes[2] === 0xff;
  if (!isPdf && !isPng && !isJpeg) {
    return { error: 'Nội dung tệp không khớp với định dạng PDF, PNG hoặc JPEG.' };
  }

  const safeFileName = file.name
    .normalize('NFKC')
    .replace(/[\/\\\u0000-\u001f\u007f]/g, '_')
    .trim()
    .slice(0, 180) || 'signed-leave-document';
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const requestResult = await client.query(
      `SELECT employee_id, status, document_data
         FROM leave_requests
        WHERE id = $1
        FOR UPDATE`,
      [requestId]
    );
    const leaveRequest = requestResult.rows[0];
    if (!leaveRequest) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy đơn nghỉ phép.' };
    }
    if (leaveRequest.employee_id !== currentUser.id) {
      await client.query('ROLLBACK');
      return { error: 'Chỉ người tạo đơn mới được nộp giấy nghỉ phép.' };
    }
    if (leaveRequest.status !== 'WAITING_FOR_DOC' || leaveRequest.document_data) {
      await client.query('ROLLBACK');
      return { error: 'Chỉ có thể nộp giấy một lần khi đơn đang ở trạng thái chờ nộp giấy.' };
    }

    const updateResult = await client.query(
      `UPDATE leave_requests
          SET document_data = $1,
              document_mime_type = $2,
              document_file_name = $3,
              document_uploaded_at = NOW(),
              document_url = $4,
              status = 'COMPLETED',
              updated_at = NOW()
        WHERE id = $5
          AND employee_id = $6
          AND status = 'WAITING_FOR_DOC'
          AND document_data IS NULL`,
      [documentBytes, file.type, safeFileName, `/api/leave/${requestId}/document`, requestId, currentUser.id]
    );
    if (updateResult.rowCount !== 1) {
      await client.query('ROLLBACK');
      return { error: 'Đơn đã được cập nhật ở nơi khác. Tải lại trang và kiểm tra trạng thái.' };
    }

    await client.query('COMMIT');
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Kết nối có thể không vào được transaction hoặc đã bị đóng.
      }
    }
    console.error('[Upload Leave Document Error]', error);
    return { error: 'Không thể lưu giấy nghỉ phép lúc này. Vui lòng thử lại sau.' };
  } finally {
    client?.release();
  }

  revalidatePath('/leave');
  revalidatePath(`/leave/${requestId}`);
  revalidatePath('/');
  redirect(`/leave/${requestId}`);
}

/**
 * Server Action: Tạo đơn nghỉ phép mới
 */
export async function createLeaveRequestAction(
  prevState: LeaveActionState | null,
  formData: FormData
): Promise<LeaveActionState> {
  const currentUser = await requireAuth();

  // Giám đốc không tạo đơn nghỉ phép trên hệ thống
  if (currentUser.role === 'DIRECTOR') {
    return { error: 'Tài khoản Giám đốc (DIRECTOR) không tạo đơn nghỉ phép trên ứng dụng.' };
  }

  // 2. Validate dữ liệu đầu vào
  const rawStartDate = formData.get('startDate');
  const rawEndDate = formData.get('endDate');
  const rawReason = formData.get('reason');

  const validated = createLeaveSchema.safeParse({
    startDate: rawStartDate,
    endDate: rawEndDate,
    reason: rawReason,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ.' };
  }

  const { startDate, endDate, reason } = validated.data;

  // 3. Tính số ngày nghỉ làm việc thực tế ở Server (trừ Chủ Nhật và ngày lễ)
  let durationDays: number;
  try {
    durationDays = await calculateWorkingDaysWithHolidays(startDate, endDate);
  } catch {
    return { error: 'Khoảng ngày không hợp lệ.' };
  }

  if (durationDays <= 0) {
    return {
      error: 'Khoảng thời gian bạn chọn không có ngày làm việc nào (toàn bộ rơi vào ngày Chủ Nhật hoặc ngày lễ).',
    };
  }

  // 4. Kiểm tra trùng + ghi đơn trong cùng transaction để chống race condition
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const overlapCheck = await client.query(
      `SELECT id FROM leave_requests
       WHERE employee_id = $1
         AND status NOT IN ('REJECTED')
         AND start_date <= $2
         AND end_date >= $3
       LIMIT 1`,
      [currentUser.id, endDate, startDate]
    );

    if (overlapCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return {
        error: 'Bạn đã có một đơn nghỉ phép khác đang chờ xử lý hoặc đã duyệt trong khoảng thời gian này.',
      };
    }

    await client.query(
      `INSERT INTO leave_requests (employee_id, start_date, end_date, duration_days, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
      [currentUser.id, startDate, endDate, durationDays, reason.trim()]
    );
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Create Leave Error]', error);
    return { error: 'Không thể tạo đơn nghỉ phép lúc này. Vui lòng thử lại sau.' };
  } finally {
    client.release();
  }

  revalidatePath('/leave');
  redirect('/leave');
}

/**
 * Server Action: Phê duyệt đơn nghỉ phép
 */
export async function approveLeaveRequestAction(
  prevState: LeaveActionState | null,
  formData: FormData
): Promise<LeaveActionState> {
  const currentUser = await requireAuth();
  const requestId = formData.get('requestId') as string;
  const comment = (formData.get('comment') as string) || null;

  if (!requestId) {
    return { error: 'Thiếu mã đơn cần phê duyệt.' };
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Khóa hàng FOR UPDATE để chống thao tác đồng thời (race condition)
    const selectRes = await client.query(
      `SELECT id, employee_id, status, duration_days::float AS duration_days 
       FROM leave_requests 
       WHERE id = $1 
       FOR UPDATE`,
      [requestId]
    );

    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy đơn nghỉ phép.' };
    }

    const leaveRequest = selectRes.rows[0];
    const applicant = await getSafeUserById(leaveRequest.employee_id);

    if (!applicant) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy thông tin nhân viên tạo đơn.' };
    }

    const directorDirectApproval = currentUser.role === 'DIRECTOR'
      && leaveRequest.status === 'PENDING'
      && !(await hasActiveManagerForDepartment(applicant.department_id));

    // 2. Kiểm tra thẩm quyền phê duyệt
    const evaluation = evaluateLeaveApproval(
      currentUser,
      applicant,
      leaveRequest.status as LeaveStatus,
      leaveRequest.duration_days,
      directorDirectApproval
    );

    if (!evaluation.allowed || !evaluation.nextStatus || !evaluation.action) {
      await client.query('ROLLBACK');
      return { error: evaluation.reason || 'Bạn không có thẩm quyền phê duyệt đơn này.' };
    }

    // 3. Cập nhật trạng thái đơn nghỉ phép
    await client.query(
      `UPDATE leave_requests 
       SET status = $1, approver_id = $2, updated_at = NOW() 
       WHERE id = $3`,
      [evaluation.nextStatus, currentUser.id, requestId]
    );

    // 4. Ghi nhận vào lịch sử phê duyệt
    await client.query(
      `INSERT INTO approval_history (request_type, request_id, approver_id, action, comment) 
       VALUES ('LEAVE', $1, $2, $3, $4)`,
      [requestId, currentUser.id, evaluation.action, comment]
    );

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Approve Leave Error]', error);
    return { error: 'Có lỗi xảy ra trong quá trình xử lý phê duyệt. Vui lòng thử lại sau.' };
  } finally {
    client.release();
  }

  revalidatePath('/approvals/leave');
  revalidatePath(`/leave/${requestId}`);
  return { success: true };
}

/**
 * Server Action: Từ chối đơn nghỉ phép
 */
export async function rejectLeaveRequestAction(
  prevState: LeaveActionState | null,
  formData: FormData
): Promise<LeaveActionState> {
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

    // 1. Khóa hàng FOR UPDATE
    const selectRes = await client.query(
      `SELECT id, employee_id, status, duration_days::float AS duration_days 
       FROM leave_requests 
       WHERE id = $1 
       FOR UPDATE`,
      [requestId]
    );

    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy đơn nghỉ phép.' };
    }

    const leaveRequest = selectRes.rows[0];
    const applicant = await getSafeUserById(leaveRequest.employee_id);

    if (!applicant) {
      await client.query('ROLLBACK');
      return { error: 'Không tìm thấy thông tin nhân viên tạo đơn.' };
    }

    const directorDirectApproval = currentUser.role === 'DIRECTOR'
      && leaveRequest.status === 'PENDING'
      && !(await hasActiveManagerForDepartment(applicant.department_id));

    // 2. Kiểm tra thẩm quyền từ chối
    const evaluation = evaluateLeaveRejection(
      currentUser,
      applicant,
      leaveRequest.status as LeaveStatus,
      leaveRequest.duration_days,
      directorDirectApproval
    );

    if (!evaluation.allowed) {
      await client.query('ROLLBACK');
      return { error: evaluation.reason || 'Bạn không có thẩm quyền từ chối đơn này.' };
    }

    // 3. Cập nhật trạng thái thành REJECTED
    await client.query(
      `UPDATE leave_requests 
       SET status = 'REJECTED', approver_id = $1, rejection_reason = $2, updated_at = NOW() 
       WHERE id = $3`,
      [currentUser.id, rejectionReason, requestId]
    );

    // 4. Ghi nhận vào lịch sử phê duyệt
    await client.query(
      `INSERT INTO approval_history (request_type, request_id, approver_id, action, comment) 
       VALUES ('LEAVE', $1, $2, 'REJECTED', $3)`,
      [requestId, currentUser.id, rejectionReason]
    );

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Reject Leave Error]', error);
    return { error: 'Có lỗi xảy ra trong quá trình từ chối đơn. Vui lòng thử lại sau.' };
  } finally {
    client.release();
  }

  revalidatePath('/approvals/leave');
  revalidatePath(`/leave/${requestId}`);
  return { success: true };
}
