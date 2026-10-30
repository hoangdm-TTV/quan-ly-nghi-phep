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
import { notifyLeaveApprovers, notifyLeaveRequester } from '@/lib/notifications/push';

const createLeaveSchema = z.object({
  startDate: z.string().refine(isRealDate, 'Ngày bắt đầu không hợp lệ (YYYY-MM-DD)'),
  endDate: z.string().refine(isRealDate, 'Ngày kết thúc không hợp lệ (YYYY-MM-DD)'),
  dayPart: z.enum(['FULL_DAY', 'MORNING', 'AFTERNOON']).default('FULL_DAY'),
  replacementUserId: z.string().uuid().optional().or(z.literal('')),
  handoverNote: z.string().trim().max(2000, 'Ghi chú bàn giao không được vượt quá 2000 ký tự.').optional(),
  reason: z.string().trim().min(5, 'Lý do nghỉ phép phải có ít nhất 5 ký tự').max(1000, 'Lý do quá dài'),
});
const approvalInputSchema = z.object({
  requestId: z.string().uuid('Mã đơn không hợp lệ.'),
  comment: z.string().trim().max(1000, 'Ghi chú không được vượt quá 1000 ký tự.').optional(),
});
const rejectionInputSchema = z.object({
  requestId: z.string().uuid('Mã đơn không hợp lệ.'),
  rejectionReason: z.string().trim().min(5, 'Lý do từ chối cần ít nhất 5 ký tự.').max(1000, 'Lý do từ chối không được vượt quá 1000 ký tự.'),
});
const editLeaveSchema = z.object({
  requestId: z.string().uuid('Mã đơn không hợp lệ.'),
  startDate: z.string().refine(isRealDate, 'Ngày bắt đầu không hợp lệ (YYYY-MM-DD)'),
  endDate: z.string().refine(isRealDate, 'Ngày kết thúc không hợp lệ (YYYY-MM-DD)'),
  reason: z.string().trim().min(5, 'Lý do nghỉ phép phải có ít nhất 5 ký tự').max(1000, 'Lý do quá dài'),
});

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

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
  const rawDayPart = formData.get('dayPart') || 'FULL_DAY';
  const rawReplacementUserId = formData.get('replacementUserId') || '';
  const rawHandoverNote = formData.get('handoverNote') || '';
  const rawReason = formData.get('reason');

  const validated = createLeaveSchema.safeParse({
    startDate: rawStartDate,
    endDate: rawEndDate,
    dayPart: rawDayPart,
    replacementUserId: rawReplacementUserId,
    handoverNote: rawHandoverNote,
    reason: rawReason,
  });

  if (!validated.success) {
    return { error: validated.error.errors[0]?.message || 'Dữ liệu không hợp lệ.' };
  }

  const { startDate, endDate, dayPart, replacementUserId, handoverNote, reason } = validated.data;
  if (endDate < startDate) return { error: 'Ngày kết thúc không được trước ngày bắt đầu.' };

  if (dayPart !== 'FULL_DAY' && startDate !== endDate) {
    return { error: 'Nghỉ buổi sáng hoặc buổi chiều chỉ áp dụng trong một ngày.' };
  }
  if (replacementUserId === currentUser.id) {
    return { error: 'Người thay thế phải là một nhân viên khác.' };
  }

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

  const effectiveDuration = dayPart === 'FULL_DAY' ? durationDays : 0.5;

  // 4. Kiểm tra trùng + ghi đơn trong cùng transaction để chống race condition
  const client = await pool.connect();
  let requestId: string | undefined;
  try {
    await client.query('BEGIN');
    // Serialize submissions by employee so concurrent requests cannot both pass the overlap check.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [currentUser.id]);
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

    const leaveYear = Number(startDate.slice(0, 4));
    const balanceResult = await client.query<{ entitled_days: number; used_days: number; pending_days: number }>(
      `SELECT e.entitled_days::float AS entitled_days,
              COALESCE(SUM(lr.duration_days) FILTER (WHERE lr.status IN ('WAITING_FOR_DOC', 'COMPLETED')), 0)::float AS used_days,
              COALESCE(SUM(lr.duration_days) FILTER (WHERE lr.status IN ('PENDING', 'APPROVED_BY_LEAD')), 0)::float AS pending_days
         FROM leave_entitlements e
         LEFT JOIN leave_requests lr ON lr.employee_id = e.user_id AND EXTRACT(YEAR FROM lr.start_date) = e.leave_year
        WHERE e.user_id = $1 AND e.leave_year = $2
        GROUP BY e.entitled_days`,
      [currentUser.id, leaveYear]
    );
    const balance = balanceResult.rows[0];
    if (balance && Number(balance.used_days) + Number(balance.pending_days) + effectiveDuration > Number(balance.entitled_days)) {
      const remaining = Math.max(0, Number(balance.entitled_days) - Number(balance.used_days) - Number(balance.pending_days));
      await client.query('ROLLBACK');
      return { error: `Số ngày còn khả dụng trong năm ${leaveYear} là ${remaining}. Đơn này cần ${effectiveDuration} ngày.` };
    }

    const insertResult = await client.query<{ id: string }>(
      `INSERT INTO leave_requests
        (employee_id, start_date, end_date, duration_days, day_part, replacement_user_id, handover_note, reason, status)
       VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::uuid, NULLIF($7, ''), $8, 'PENDING') RETURNING id`,
      [currentUser.id, startDate, endDate, effectiveDuration, dayPart, replacementUserId || '', handoverNote?.trim() || '', reason.trim()]
    );
    requestId = insertResult.rows[0]?.id;
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Create Leave Error]', error);
    return { error: 'Không thể tạo đơn nghỉ phép lúc này. Vui lòng thử lại sau.' };
  } finally {
    client.release();
  }

  if (requestId) {
    await notifyLeaveApprovers(requestId).catch((error) => {
      console.error('[Leave Push Notification Error]', error);
    });
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
  const input = approvalInputSchema.safeParse({
    requestId: formData.get('requestId'),
    comment: formData.get('comment') || undefined,
  });
  if (!input.success) return { error: input.error.errors[0]?.message || 'Thông tin phê duyệt không hợp lệ.' };
  const { requestId } = input.data;
  const comment = input.data.comment || null;

  const client = await pool.connect();
  let nextStatus: LeaveStatus | undefined;

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
    nextStatus = evaluation.nextStatus;

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

  if (nextStatus === 'APPROVED_BY_LEAD') {
    await notifyLeaveApprovers(requestId).catch((error) => {
      console.error('[Leave Push Notification Error]', error);
    });
  }
  await notifyLeaveRequester(requestId, nextStatus === 'APPROVED_BY_LEAD' ? 'APPROVED_BY_LEAD' : 'WAITING_FOR_DOC').catch((error) => console.error('[Leave Requester Push Error]', error));
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
  const input = rejectionInputSchema.safeParse({
    requestId: formData.get('requestId'),
    rejectionReason: formData.get('rejectionReason'),
  });
  if (!input.success) return { error: input.error.errors[0]?.message || 'Thông tin từ chối không hợp lệ.' };
  const { requestId, rejectionReason } = input.data;

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
  await notifyLeaveRequester(requestId, 'REJECTED').catch((error) => console.error('[Leave Requester Push Error]', error));
  return { success: true };
}

export async function updatePendingLeaveRequestAction(
  _prevState: LeaveActionState | null,
  formData: FormData
): Promise<LeaveActionState> {
  const user = await requireAuth();
  const parsed = editLeaveSchema.safeParse({
    requestId: formData.get('requestId'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Thông tin đơn không hợp lệ.' };
  const { requestId, startDate, endDate, reason } = parsed.data;
  if (endDate < startDate) return { error: 'Ngày kết thúc không được trước ngày bắt đầu.' };
  let durationDays: number;
  try { durationDays = await calculateWorkingDaysWithHolidays(startDate, endDate); }
  catch { return { error: 'Khoảng ngày không hợp lệ.' }; }
  if (durationDays <= 0) return { error: 'Khoảng ngày không có ngày làm việc.' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id]);
    const currentResult = await client.query(
      `SELECT id, employee_id, status, start_date::text AS start_date, end_date::text AS end_date,
              duration_days::float AS duration_days, reason
         FROM leave_requests WHERE id = $1 FOR UPDATE`,
      [requestId],
    );
    const current = currentResult.rows[0];
    if (!current || current.employee_id !== user.id || current.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return { error: 'Chỉ có thể sửa đơn đang chờ duyệt của chính bạn.' };
    }
    const overlap = await client.query(
      `SELECT 1 FROM leave_requests
        WHERE employee_id = $1 AND id <> $2 AND status NOT IN ('REJECTED', 'CANCELLED')
          AND start_date <= $3 AND end_date >= $4 LIMIT 1`,
      [user.id, requestId, endDate, startDate],
    );
    if (overlap.rowCount) {
      await client.query('ROLLBACK');
      return { error: 'Khoảng ngày mới bị trùng với một đơn khác.' };
    }
    const year = Number(startDate.slice(0, 4));
    const balance = await client.query<{ entitled_days: number; committed_days: number }>(
      `SELECT e.entitled_days::float AS entitled_days,
              COALESCE(SUM(lr.duration_days) FILTER (WHERE lr.status IN ('WAITING_FOR_DOC','COMPLETED','PENDING','APPROVED_BY_LEAD')), 0)::float AS committed_days
         FROM leave_entitlements e
         LEFT JOIN leave_requests lr ON lr.employee_id = e.user_id AND EXTRACT(YEAR FROM lr.start_date) = e.leave_year AND lr.id <> $3
        WHERE e.user_id = $1 AND e.leave_year = $2 GROUP BY e.entitled_days`,
      [user.id, year, requestId],
    );
    const quota = balance.rows[0];
    if (quota && Number(quota.committed_days) + durationDays > Number(quota.entitled_days)) {
      await client.query('ROLLBACK');
      return { error: `Hạn mức nghỉ phép năm ${year} không đủ cho khoảng ngày mới.` };
    }
    await client.query(
      `UPDATE leave_requests SET start_date = $1, end_date = $2, duration_days = $3, reason = $4, updated_at = NOW() WHERE id = $5`,
      [startDate, endDate, durationDays, reason, requestId],
    );
    await client.query(
      `INSERT INTO request_change_history (request_type, request_id, actor_id, action, before_data, after_data)
       VALUES ('LEAVE', $1, $2, 'UPDATED', $3::jsonb, $4::jsonb)`,
      [requestId, user.id, JSON.stringify(current), JSON.stringify({ start_date: startDate, end_date: endDate, duration_days: durationDays, reason })],
    );
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Update Leave Request Error]', error);
    return { error: 'Không thể cập nhật đơn nghỉ phép lúc này.' };
  } finally { client.release(); }
  revalidatePath('/leave');
  revalidatePath(`/leave/${requestId}`);
  revalidatePath('/approvals/leave');
  revalidatePath('/');
  await notifyLeaveApprovers(requestId).catch((error) => console.error('[Leave Updated Request Push Error]', error));
  return { success: true };
}

export async function cancelPendingLeaveRequestAction(
  _prevState: LeaveActionState | null,
  formData: FormData
): Promise<LeaveActionState> {
  const user = await requireAuth();
  const parsedId = z.string().uuid().safeParse(formData.get('requestId'));
  if (!parsedId.success) return { error: 'Mã đơn không hợp lệ.' };
  const requestId = parsedId.data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id]);
    const selected = await client.query(
      `SELECT id, employee_id, status, start_date::text AS start_date, end_date::text AS end_date,
              duration_days::float AS duration_days, reason
         FROM leave_requests WHERE id = $1 FOR UPDATE`, [requestId]);
    const current = selected.rows[0];
    if (!current || current.employee_id !== user.id || current.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return { error: 'Chỉ có thể hủy đơn đang chờ duyệt của chính bạn.' };
    }
    await client.query("UPDATE leave_requests SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [requestId]);
    await client.query(
      `INSERT INTO request_change_history (request_type, request_id, actor_id, action, before_data, after_data)
       VALUES ('LEAVE', $1, $2, 'CANCELLED', $3::jsonb, '{"status":"CANCELLED"}'::jsonb)`,
      [requestId, user.id, JSON.stringify(current)],
    );
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Cancel Leave Request Error]', error);
    return { error: 'Không thể hủy đơn nghỉ phép lúc này.' };
  } finally { client.release(); }
  revalidatePath('/leave');
  revalidatePath(`/leave/${requestId}`);
  revalidatePath('/approvals/leave');
  revalidatePath('/');
  return { success: true };
}
