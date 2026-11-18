"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db/pool";
import { requireAuth } from "@/lib/auth/permissions";
import {
  canApproveOutOfficeRequests,
  canSubmitPersonalRequests,
} from "@/lib/auth/roles";
import { getSafeUserById } from "@/lib/db/queries/users";
import { calculateEstimatedHours } from "./calculator";
import {
  evaluateOutOfficeApproval,
  evaluateOutOfficeRejection,
  OutOfficeStatus,
} from "./workflow";
import {
  notifyOutOfficeApprovers,
  notifyOutOfficeRequester,
} from "@/lib/notifications/push";

const createOutOfficeSchema = z.object({
  requestDate: z.string().refine(isRealDate, "Ngày không hợp lệ (YYYY-MM-DD)"),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Giờ bắt đầu không hợp lệ (HH:MM)"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Giờ kết thúc không hợp lệ (HH:MM)"),
  reasonType: z.enum(["WORK", "PERSONAL"], {
    errorMap: () => ({
      message: "Vui lòng chọn loại lý do: Công việc hoặc Việc riêng",
    }),
  }),
  reason: z
    .string()
    .trim()
    .min(5, "Lý do xin ra ngoài phải có ít nhất 5 ký tự")
    .max(1000, "Lý do quá dài"),
});
const approvalInputSchema = z.object({
  requestId: z.string().uuid("Mã đơn không hợp lệ."),
  comment: z
    .string()
    .trim()
    .max(1000, "Ghi chú không được vượt quá 1000 ký tự.")
    .optional(),
});
const rejectionInputSchema = z.object({
  requestId: z.string().uuid("Mã đơn không hợp lệ."),
  rejectionReason: z
    .string()
    .trim()
    .min(5, "Lý do từ chối cần ít nhất 5 ký tự.")
    .max(1000, "Lý do từ chối không được vượt quá 1000 ký tự."),
});
const editOutOfficeSchema = createOutOfficeSchema.extend({
  requestId: z.string().uuid("Mã đơn không hợp lệ."),
});
const MAX_RETURN_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_RETURN_PDF_SIZE = 50 * 1024 * 1024;

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export type OutOfficeActionState = {
  success?: boolean;
  error?: string;
};

/**
 * Server Action: Tạo đơn xin ra ngoài mới
 */
export async function createOutOfficeRequestAction(
  prevState: OutOfficeActionState | null,
  formData: FormData,
): Promise<OutOfficeActionState> {
  const currentUser = await requireAuth();
  if (!canSubmitPersonalRequests(currentUser.role)) {
    return { error: "Tài khoản này không có quyền tạo đơn ra ngoài." };
  }

  if (!currentUser.manager_id || currentUser.manager_id === currentUser.id) {
    return { error: "Bạn chưa được gán người duyệt hợp lệ. Vui lòng liên hệ quản trị nhân sự." };
  }

  const rawDate = formData.get("requestDate");
  const rawStartTime = formData.get("startTime");
  const rawEndTime = formData.get("endTime");
  const rawReasonType = formData.get("reasonType");
  const rawReason = formData.get("reason");

  const validated = createOutOfficeSchema.safeParse({
    requestDate: rawDate,
    startTime: rawStartTime,
    endTime: rawEndTime,
    reasonType: rawReasonType,
    reason: rawReason,
  });

  if (!validated.success) {
    return {
      error: validated.error.errors[0]?.message || "Dữ liệu không hợp lệ.",
    };
  }

  const { requestDate, startTime, endTime, reasonType, reason } =
    validated.data;

  // 1. Tính số giờ ở server
  let estimatedHours: number;
  try {
    estimatedHours = calculateEstimatedHours(startTime, endTime);
  } catch {
    return { error: "Khoảng thời gian không hợp lệ." };
  }

  // 2. Kiểm tra trùng + ghi đơn trong cùng transaction để chống race condition
  const client = await pool.connect();
  let requestId: string | undefined;
  try {
    await client.query("BEGIN");
    // Serialize submissions by employee so concurrent requests cannot both pass the overlap check.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      currentUser.id,
    ]);
    const overlapCheck = await client.query(
      `SELECT id FROM out_office_requests
       WHERE employee_id = $1
         AND request_date = $2
         AND status NOT IN ('REJECTED')
         AND start_time < $3
         AND end_time > $4
       LIMIT 1`,
      [currentUser.id, requestDate, endTime, startTime],
    );

    if (overlapCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return {
        error:
          "Bạn đã có một đơn ra ngoài khác trong cùng khoảng thời gian này.",
      };
    }

    const insertResult = await client.query<{ id: string }>(
      `INSERT INTO out_office_requests
        (employee_id, request_date, start_time, end_time, estimated_hours, reason_type, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING') RETURNING id`,
      [
        currentUser.id,
        requestDate,
        startTime,
        endTime,
        estimatedHours,
        reasonType,
        reason.trim(),
      ],
    );
    requestId = insertResult.rows[0].id;
    await client.query(
      `INSERT INTO request_change_history
        (request_type, request_id, actor_id, action, after_data)
       VALUES ('OUT_OFFICE', $1, $2, 'CREATED', $3::jsonb)`,
      [
        requestId,
        currentUser.id,
        JSON.stringify({
          request_date: requestDate,
          start_time: startTime,
          end_time: endTime,
          estimated_hours: estimatedHours,
          reason_type: reasonType,
          reason: reason.trim(),
          status: "PENDING",
        }),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("[Create Gate Pass Error]", error);
    return {
      error: "Không thể tạo đơn xin ra ngoài lúc này. Vui lòng thử lại sau.",
    };
  } finally {
    client.release();
  }

  if (requestId) {
    await notifyOutOfficeApprovers(requestId).catch((error) => {
      console.error("[Out Office Push Notification Error]", error);
    });
  }
  revalidatePath("/out-office");
  redirect("/out-office");
}

/**
 * Server Action: Phê duyệt đơn xin ra ngoài
 */
export async function approveOutOfficeRequestAction(
  prevState: OutOfficeActionState | null,
  formData: FormData,
): Promise<OutOfficeActionState> {
  const currentUser = await requireAuth();
  if (!canApproveOutOfficeRequests(currentUser.role)) {
    return { error: "Tài khoản này không có quyền duyệt đơn ra ngoài." };
  }
  const input = approvalInputSchema.safeParse({
    requestId: formData.get("requestId"),
    comment: formData.get("comment") || undefined,
  });
  if (!input.success)
    return {
      error:
        input.error.errors[0]?.message || "Thông tin phê duyệt không hợp lệ.",
    };
  const { requestId } = input.data;
  const comment = input.data.comment || null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Khóa hàng FOR UPDATE
    const selectRes = await client.query(
      `SELECT id, employee_id, status, approver_id
       FROM out_office_requests 
       WHERE id = $1 
       FOR UPDATE`,
      [requestId],
    );

    if (selectRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy đơn xin ra ngoài." };
    }

    const request = selectRes.rows[0];
    const applicant = await getSafeUserById(request.employee_id);

    if (!applicant) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy thông tin nhân viên tạo đơn." };
    }

    const evaluation = evaluateOutOfficeApproval(
      currentUser,
      applicant,
      request.status as OutOfficeStatus,
    );

    if (!evaluation.allowed || !evaluation.nextStatus || !evaluation.action) {
      await client.query("ROLLBACK");
      return {
        error: evaluation.reason || "Bạn không có thẩm quyền xử lý đơn này.",
      };
    }
    await client.query(
      `UPDATE out_office_requests 
       SET status = $1, approver_id = $2, updated_at = NOW() 
       WHERE id = $3`,
      [evaluation.nextStatus, currentUser.id, requestId],
    );

    await client.query(
      `INSERT INTO approval_history (request_type, request_id, approver_id, action, comment) 
       VALUES ('OUT_OFFICE', $1, $2, $3, $4)`,
      [requestId, currentUser.id, evaluation.action, comment],
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("[Approve Gate Pass Error]", error);
    return { error: "Có lỗi xảy ra khi phê duyệt đơn. Vui lòng thử lại sau." };
  } finally {
    client.release();
  }

  revalidatePath("/approvals/out-office");
  revalidatePath(`/out-office/${requestId}`);
  await notifyOutOfficeRequester(requestId, "APPROVED").catch((error) =>
    console.error("[Out Office Requester Push Error]", error),
  );
  return { success: true };
}

/**
 * Nhân viên nộp giấy xác nhận khi về; thời điểm lưu tệp là giờ về thực tế.
 */
export async function uploadOutOfficeReturnDocumentAction(
  _prevState: OutOfficeActionState | null,
  formData: FormData,
): Promise<OutOfficeActionState> {
  const currentUser = await requireAuth();
  if (!canSubmitPersonalRequests(currentUser.role)) {
    return { error: "Tài khoản này không có quyền nộp giấy xác nhận về." };
  }

  const parsedRequestId = z
    .string()
    .uuid()
    .safeParse(formData.get("requestId"));
  if (!parsedRequestId.success) {
    return { error: "Mã đơn ra ngoài không hợp lệ." };
  }

  const fileValue = formData.get("documentFile");
  if (!fileValue || typeof fileValue === "string") {
    return { error: "Vui lòng chọn ảnh hoặc PDF giấy xác nhận khi về." };
  }
  const file = fileValue as File;
  if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
    return { error: "Chỉ chấp nhận tệp PDF, PNG hoặc JPEG." };
  }
  const maxSize =
    file.type === "application/pdf"
      ? MAX_RETURN_PDF_SIZE
      : MAX_RETURN_IMAGE_SIZE;
  if (file.size <= 0 || file.size > maxSize) {
    return {
      error:
        file.type === "application/pdf"
          ? "Tệp PDF phải có dung lượng lớn hơn 0 và không vượt quá 50 MB."
          : "Ảnh phải có dung lượng lớn hơn 0 và không vượt quá 5 MB.",
    };
  }

  let documentBytes: Buffer;
  try {
    documentBytes = Buffer.from(await file.arrayBuffer());
  } catch {
    return { error: "Không thể đọc tệp đã chọn. Vui lòng thử lại." };
  }

  const isPdf =
    file.type === "application/pdf" &&
    documentBytes.subarray(0, 5).toString("ascii") === "%PDF-";
  const isPng =
    file.type === "image/png" &&
    documentBytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg =
    file.type === "image/jpeg" &&
    documentBytes.length >= 3 &&
    documentBytes[0] === 0xff &&
    documentBytes[1] === 0xd8 &&
    documentBytes[2] === 0xff;
  if (!isPdf && !isPng && !isJpeg) {
    return {
      error: "Nội dung tệp không khớp với định dạng PDF, PNG hoặc JPEG.",
    };
  }

  const safeFileName =
    file.name
      .normalize("NFKC")
      .replace(/[\/\\\u0000-\u001f\u007f]/g, "_")
      .trim()
      .slice(0, 180) || "out-office-return-document";
  const requestId = parsedRequestId.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const requestResult = await client.query(
      `SELECT employee_id, status, return_document_data
         FROM out_office_requests
        WHERE id = $1
        FOR UPDATE`,
      [requestId],
    );
    const request = requestResult.rows[0];
    if (!request) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy đơn xin ra ngoài." };
    }
    if (request.employee_id !== currentUser.id) {
      await client.query("ROLLBACK");
      return { error: "Chỉ người tạo đơn mới được nộp giấy xác nhận về." };
    }
    if (request.status !== "APPROVED" || request.return_document_data) {
      await client.query("ROLLBACK");
      return {
        error: "Chỉ có thể nộp giấy một lần cho đơn đã được duyệt.",
      };
    }

    const updateResult = await client.query<{ actual_return_at: Date }>(
      `UPDATE out_office_requests
          SET return_document_data = $1,
              return_document_mime_type = $2,
              return_document_file_name = $3,
              actual_return_at = NOW(),
              status = 'COMPLETED',
              updated_at = NOW()
        WHERE id = $4
          AND employee_id = $5
          AND status = 'APPROVED'
          AND return_document_data IS NULL
        RETURNING actual_return_at`,
      [
        documentBytes,
        file.type,
        safeFileName,
        requestId,
        currentUser.id,
      ],
    );
    if (updateResult.rowCount !== 1) {
      await client.query("ROLLBACK");
      return {
        error:
          "Đơn đã được cập nhật ở nơi khác. Tải lại trang và kiểm tra trạng thái.",
      };
    }
    const actualReturnAt = updateResult.rows[0].actual_return_at;
    await client.query(
      `INSERT INTO request_change_history
        (request_type, request_id, actor_id, action, before_data, after_data)
       VALUES ('OUT_OFFICE', $1, $2, 'RETURN_DOCUMENT_UPLOADED', $3::jsonb, $4::jsonb)`,
      [
        requestId,
        currentUser.id,
        JSON.stringify({ status: "APPROVED" }),
        JSON.stringify({
          status: "COMPLETED",
          return_document_file_name: safeFileName,
          actual_return_at: actualReturnAt,
        }),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("[Upload Out Office Return Document Error]", error);
    return {
      error: "Không thể lưu giấy xác nhận về lúc này. Vui lòng thử lại sau.",
    };
  } finally {
    client.release();
  }

  revalidatePath("/out-office");
  revalidatePath(`/out-office/${requestId}`);
  revalidatePath("/approvals/out-office");
  revalidatePath("/");
  await notifyOutOfficeRequester(requestId, "COMPLETED").catch((error) =>
    console.error("[Out Office Requester Push Error]", error),
  );
  redirect(`/out-office/${requestId}`);
}

/**
 * Server Action: Từ chối đơn xin ra ngoài
 */
export async function rejectOutOfficeRequestAction(
  prevState: OutOfficeActionState | null,
  formData: FormData,
): Promise<OutOfficeActionState> {
  const currentUser = await requireAuth();
  if (!canApproveOutOfficeRequests(currentUser.role)) {
    return { error: "Tài khoản này không có quyền từ chối đơn ra ngoài." };
  }
  const input = rejectionInputSchema.safeParse({
    requestId: formData.get("requestId"),
    rejectionReason: formData.get("rejectionReason"),
  });
  if (!input.success)
    return {
      error:
        input.error.errors[0]?.message || "Thông tin từ chối không hợp lệ.",
    };
  const { requestId, rejectionReason } = input.data;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const selectRes = await client.query(
      `SELECT id, employee_id, status, approver_id
       FROM out_office_requests 
       WHERE id = $1 
       FOR UPDATE`,
      [requestId],
    );

    if (selectRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy đơn xin ra ngoài." };
    }

    const request = selectRes.rows[0];
    const applicant = await getSafeUserById(request.employee_id);

    if (!applicant) {
      await client.query("ROLLBACK");
      return { error: "Không tìm thấy thông tin nhân viên tạo đơn." };
    }

    const evaluation = evaluateOutOfficeRejection(
      currentUser,
      applicant,
      request.status as OutOfficeStatus,
    );

    if (!evaluation.allowed) {
      await client.query("ROLLBACK");
      return {
        error: evaluation.reason || "Bạn không có thẩm quyền từ chối đơn này.",
      };
    }

    await client.query(
      `UPDATE out_office_requests 
       SET status = 'REJECTED', approver_id = $1, rejection_reason = $2, updated_at = NOW() 
       WHERE id = $3`,
      [currentUser.id, rejectionReason, requestId],
    );

    await client.query(
      `INSERT INTO approval_history (request_type, request_id, approver_id, action, comment) 
       VALUES ('OUT_OFFICE', $1, $2, 'REJECTED', $3)`,
      [requestId, currentUser.id, rejectionReason],
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("[Reject Gate Pass Error]", error);
    return { error: "Có lỗi xảy ra khi từ chối đơn. Vui lòng thử lại sau." };
  } finally {
    client.release();
  }

  revalidatePath("/approvals/out-office");
  revalidatePath(`/out-office/${requestId}`);
  await notifyOutOfficeRequester(requestId, "REJECTED").catch((error) =>
    console.error("[Out Office Requester Push Error]", error),
  );
  return { success: true };
}

export async function updatePendingOutOfficeRequestAction(
  _prevState: OutOfficeActionState | null,
  formData: FormData,
): Promise<OutOfficeActionState> {
  const user = await requireAuth();
  const parsed = editOutOfficeSchema.safeParse({
    requestId: formData.get("requestId"),
    requestDate: formData.get("requestDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    reasonType: formData.get("reasonType"),
    reason: formData.get("reason"),
  });
  if (!parsed.success)
    return {
      error: parsed.error.errors[0]?.message || "Thông tin đơn không hợp lệ.",
    };
  const { requestId, requestDate, startTime, endTime, reasonType, reason } =
    parsed.data;
  let hours: number;
  try {
    hours = calculateEstimatedHours(startTime, endTime);
  } catch {
    return { error: "Khoảng giờ không hợp lệ." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [user.id]);
    const selected = await client.query(
      `SELECT id, employee_id, status, request_date::text AS request_date,
              TO_CHAR(start_time, 'HH24:MI') AS start_time, TO_CHAR(end_time, 'HH24:MI') AS end_time,
              estimated_hours::float AS estimated_hours, reason_type, reason
         FROM out_office_requests WHERE id = $1 FOR UPDATE`,
      [requestId],
    );
    const current = selected.rows[0];
    if (
      !current ||
      current.employee_id !== user.id ||
      current.status !== "PENDING"
    ) {
      await client.query("ROLLBACK");
      return { error: "Chỉ có thể sửa đơn đang chờ duyệt của chính bạn." };
    }
    const overlap = await client.query(
      `SELECT 1 FROM out_office_requests WHERE employee_id = $1 AND id <> $2
         AND request_date = $3 AND status NOT IN ('REJECTED','CANCELLED')
         AND start_time < $4 AND end_time > $5 LIMIT 1`,
      [user.id, requestId, requestDate, endTime, startTime],
    );
    if (overlap.rowCount) {
      await client.query("ROLLBACK");
      return { error: "Khung giờ mới bị trùng với một đơn ra ngoài khác." };
    }
    await client.query(
      `UPDATE out_office_requests SET request_date = $1, start_time = $2, end_time = $3,
              estimated_hours = $4, reason_type = $5, reason = $6, updated_at = NOW() WHERE id = $7`,
      [requestDate, startTime, endTime, hours, reasonType, reason, requestId],
    );
    await client.query(
      `INSERT INTO request_change_history (request_type, request_id, actor_id, action, before_data, after_data)
       VALUES ('OUT_OFFICE', $1, $2, 'UPDATED', $3::jsonb, $4::jsonb)`,
      [
        requestId,
        user.id,
        JSON.stringify(current),
        JSON.stringify({
          request_date: requestDate,
          start_time: startTime,
          end_time: endTime,
          estimated_hours: hours,
          reason_type: reasonType,
          reason,
        }),
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("[Update Out Office Request Error]", error);
    return { error: "Không thể cập nhật đơn ra ngoài lúc này." };
  } finally {
    client.release();
  }
  revalidatePath("/out-office");
  revalidatePath(`/out-office/${requestId}`);
  revalidatePath("/approvals/out-office");
  revalidatePath("/");
  await notifyOutOfficeApprovers(requestId).catch((error) =>
    console.error("[Out Office Updated Request Push Error]", error),
  );
  return { success: true };
}

export async function cancelPendingOutOfficeRequestAction(
  _prevState: OutOfficeActionState | null,
  formData: FormData,
): Promise<OutOfficeActionState> {
  const user = await requireAuth();
  const parsedId = z.string().uuid().safeParse(formData.get("requestId"));
  if (!parsedId.success) return { error: "Mã đơn không hợp lệ." };
  const requestId = parsedId.data;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [user.id]);
    const selected = await client.query(
      `SELECT id, employee_id, status, request_date::text AS request_date,
              TO_CHAR(start_time, 'HH24:MI') AS start_time, TO_CHAR(end_time, 'HH24:MI') AS end_time,
              estimated_hours::float AS estimated_hours, reason_type, reason
         FROM out_office_requests WHERE id = $1 FOR UPDATE`,
      [requestId],
    );
    const current = selected.rows[0];
    if (
      !current ||
      current.employee_id !== user.id ||
      current.status !== "PENDING"
    ) {
      await client.query("ROLLBACK");
      return { error: "Chỉ có thể hủy đơn đang chờ duyệt của chính bạn." };
    }
    await client.query(
      "UPDATE out_office_requests SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1",
      [requestId],
    );
    await client.query(
      `INSERT INTO request_change_history (request_type, request_id, actor_id, action, before_data, after_data)
       VALUES ('OUT_OFFICE', $1, $2, 'CANCELLED', $3::jsonb, '{"status":"CANCELLED"}'::jsonb)`,
      [requestId, user.id, JSON.stringify(current)],
    );
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("[Cancel Out Office Request Error]", error);
    return { error: "Không thể hủy đơn ra ngoài lúc này." };
  } finally {
    client.release();
  }
  revalidatePath("/out-office");
  revalidatePath(`/out-office/${requestId}`);
  revalidatePath("/approvals/out-office");
  revalidatePath("/");
  return { success: true };
}
