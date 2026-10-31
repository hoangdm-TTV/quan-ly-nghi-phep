"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db/pool";
import { requireAuth } from "@/lib/auth/permissions";
import { getSafeUserById } from "@/lib/db/queries/users";
import { calculateEstimatedHours } from "./calculator";
import {
  evaluateOutOfficeApproval,
  evaluateOutOfficeRejection,
  OutOfficeStatus,
} from "./workflow";
import { getOutOfficeRoutingAvailability } from "./routing";
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

  // Giám đốc không tạo đơn xin ra ngoài trên hệ thống
  if (currentUser.role === "DIRECTOR") {
    return {
      error:
        "Tài khoản Giám đốc (DIRECTOR) không tạo đơn ra ngoài trên hệ thống.",
    };
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
    requestId = insertResult.rows[0]?.id;
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
 * Server Action: Phê duyệt đơn xin ra ngoài (hoặc xác nhận hoàn tất khi về)
 */
export async function approveOutOfficeRequestAction(
  prevState: OutOfficeActionState | null,
  formData: FormData,
): Promise<OutOfficeActionState> {
  const currentUser = await requireAuth();
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
  let completedStatus: OutOfficeStatus | undefined;

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

    const routing = await getOutOfficeRoutingAvailability(
      applicant.department_id,
      applicant.team_id,
    );
    const evaluation = evaluateOutOfficeApproval(
      currentUser,
      applicant,
      request.status as OutOfficeStatus,
      request.approver_id,
      routing,
    );

    if (!evaluation.allowed || !evaluation.nextStatus || !evaluation.action) {
      await client.query("ROLLBACK");
      return {
        error: evaluation.reason || "Bạn không có thẩm quyền xử lý đơn này.",
      };
    }
    completedStatus = evaluation.nextStatus;

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
  await notifyOutOfficeRequester(
    requestId,
    completedStatus === "COMPLETED" ? "COMPLETED" : "APPROVED",
  ).catch((error) => console.error("[Out Office Requester Push Error]", error));
  return { success: true };
}

/**
 * Server Action: Từ chối đơn xin ra ngoài
 */
export async function rejectOutOfficeRequestAction(
  prevState: OutOfficeActionState | null,
  formData: FormData,
): Promise<OutOfficeActionState> {
  const currentUser = await requireAuth();
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

    const routing = await getOutOfficeRoutingAvailability(
      applicant.department_id,
      applicant.team_id,
    );
    const evaluation = evaluateOutOfficeRejection(
      currentUser,
      applicant,
      request.status as OutOfficeStatus,
      request.approver_id,
      routing,
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
